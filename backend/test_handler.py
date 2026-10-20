import json
import os
import sys
import types
import unittest
from decimal import Decimal
from unittest.mock import patch

from handler import lambda_handler


class FakeTable:
    name = "Contacts"

    def __init__(self):
        self.meta = types.SimpleNamespace(client=types.SimpleNamespace())
        self.transactions = []
        self.items = {}

    def transact_write_items(self, **kwargs):
        self.transactions.append(kwargs["TransactItems"])
        for operation in kwargs["TransactItems"]:
            if "Put" in operation:
                item = _deserialize(operation["Put"]["Item"])
                self.items[(item["tenantId"], item["entityKey"])] = item
            if "Update" in operation:
                update = operation["Update"]
                key = _deserialize(update["Key"])
                current = self.items[(key["tenantId"], key["entityKey"])]
                for placeholder, field in update["ExpressionAttributeNames"].items():
                    value_placeholder = f":value{placeholder.removeprefix('#field')}"
                    current[field] = _deserialize_value(update["ExpressionAttributeValues"][value_placeholder])

    def query(self, **kwargs):
        tenant_id, prefix = _condition_values(kwargs.get("KeyConditionExpression"))
        return {"Items": [
            item for item in self.items.values()
            if item["tenantId"] == tenant_id
            if prefix is None or item["entityKey"].startswith(prefix)
        ]}

    def get_item(self, **kwargs):
        return {"Item": self.items.get((kwargs["Key"]["tenantId"], kwargs["Key"]["entityKey"]))}


class LambdaHandlerTests(unittest.TestCase):
    def setUp(self):
        self.table = FakeTable()
        self.model_response = {"output": {"message": {"content": [{"text": "¿En qué te ayudo?"}]}}}
        self.boto3 = types.ModuleType("boto3")
        self.boto3.resource = lambda name: types.SimpleNamespace(Table=lambda table_name: self.table)
        self.boto3.client = self.client
        self.conditions = types.ModuleType("boto3.dynamodb.conditions")
        self.conditions.Key = lambda name: FakeKey(name)
        dynamodb = types.ModuleType("boto3.dynamodb")
        dynamodb.conditions = self.conditions
        self.types = types.ModuleType("boto3.dynamodb.types")
        self.types.TypeSerializer = FakeSerializer
        self.patcher = patch.dict(sys.modules, {
            "boto3": self.boto3,
            "boto3.dynamodb": dynamodb,
            "boto3.dynamodb.conditions": self.conditions,
            "boto3.dynamodb.types": self.types,
        })
        self.patcher.start()
        self.environment_patcher = patch.dict(os.environ, {
            "TABLE_NAME": "Contacts",
            "TENANT_CLAIM": "custom:tenantId",
            "DEMO_MODE": "false",
        })
        self.environment_patcher.start()

    def tearDown(self):
        self.patcher.stop()
        self.environment_patcher.stop()

    def event(self, method="GET", path="/prod/v1/contacts", claims=None, body=None):
        return {
            "httpMethod": method,
            "path": path,
            "headers": {"origin": "https://main.dr86wkdl0o11b.amplifyapp.com"},
            "body": json.dumps(body) if body is not None else None,
            "requestContext": {
                "stage": "prod",
                "identity": {"sourceIp": "127.0.0.1"},
                "authorizer": {"claims": claims or {}},
            },
        }

    def client(self, name):
        if name == "dynamodb":
            return types.SimpleNamespace(transact_write_items=self.table.transact_write_items)
        if name == "bedrock-runtime":
            return types.SimpleNamespace(converse=lambda **kwargs: self.model_response)
        raise AssertionError(f"Unexpected boto3 client: {name}")

    def assistant_event(self, message, mode="confirm"):
        return self.event(
            method="POST",
            path="/prod/v1/assistant",
            claims={"sub": "user-7", "custom:tenantId": "agency-42"},
            body={"messages": [{"role": "user", "content": message}], "mode": mode},
        )

    def test_rejects_missing_tenant_claim(self):
        result = lambda_handler(self.event(), None)
        self.assertEqual(result["statusCode"], 403)
        self.assertEqual(json.loads(result["body"])["error"], "Forbidden")

    def test_demo_mode_uses_fixed_demo_tenant_without_cognito_claims(self):
        with patch.dict(os.environ, {"DEMO_MODE": "true"}):
            result = lambda_handler(self.event(
                method="POST",
                claims={},
                body={"name": "Contacto ficticio", "type": "prospecto"},
            ), None)
        contact = json.loads(result["body"])
        self.assertEqual(result["statusCode"], 201)
        self.assertEqual(contact["tenantId"], "demo")
        audit = self.table.transactions[0][1]["Put"]["Item"]
        self.assertEqual(audit["actorId"]["S"], "demo-user")

    def test_demo_mode_does_not_allow_client_to_choose_another_tenant(self):
        with patch.dict(os.environ, {"DEMO_MODE": "true"}):
            result = lambda_handler(self.event(
                method="POST",
                claims={},
                body={"name": "Contacto ficticio", "type": "prospecto", "tenantId": "other"},
            ), None)
        self.assertEqual(result["statusCode"], 400)
        self.assertEqual(self.table.transactions, [])

    def test_creates_contact_and_audit_for_claimed_tenant(self):
        result = lambda_handler(self.event(
            method="POST",
            claims={"sub": "user-7", "custom:tenantId": "agency-42"},
            body={"name": "María López", "type": "cliente"},
        ), None)
        contact = json.loads(result["body"])
        self.assertEqual(result["statusCode"], 201)
        self.assertEqual(contact["tenantId"], "agency-42")
        self.assertTrue(contact["entityKey"].startswith("CONTACT#"))
        self.assertEqual(len(self.table.transactions), 1)
        audit = self.table.transactions[0][1]["Put"]["Item"]
        self.assertEqual(audit["tenantId"]["S"], "agency-42")
        self.assertEqual(audit["actorId"]["S"], "user-7")

    def test_assistant_returns_text_from_bedrock(self):
        result = lambda_handler(self.assistant_event("Hola"), None)
        self.assertEqual(result["statusCode"], 200)
        self.assertEqual(json.loads(result["body"])["reply"], "¿En qué te ayudo?")

    def test_assistant_prepares_create_for_confirmation_without_writing(self):
        self.model_response = {"output": {"message": {"content": [{
            "toolUse": {
                "name": "create_record",
                "input": {"entity": "contacts", "data": {"name": "Contacto ficticio", "type": "prospecto"}},
            }
        }]}}}
        result = lambda_handler(self.assistant_event("Prepara un prospecto ficticio"), None)
        body = json.loads(result["body"])
        self.assertEqual(result["statusCode"], 200)
        self.assertEqual(body["action"]["resource"], "contacts")
        self.assertEqual(body["action"]["data"]["name"], "Contacto ficticio")
        self.assertEqual(self.table.transactions, [])

    def test_assistant_executes_explicit_auto_create_and_audits(self):
        self.model_response = {"output": {"message": {"content": [{
            "toolUse": {
                "name": "create_record",
                "input": {"entity": "contacts", "data": {"name": "Contacto ficticio", "type": "prospecto"}},
            }
        }]}}}
        result = lambda_handler(self.assistant_event("Crea el prospecto ficticio", mode="auto"), None)
        body = json.loads(result["body"])
        self.assertEqual(result["statusCode"], 200)
        self.assertTrue(body["saved"])
        self.assertEqual(len(self.table.transactions), 1)

    def test_assistant_lists_records_without_sending_record_details_to_bedrock(self):
        lambda_handler(self.event(
            method="POST",
            claims={"sub": "user-7", "custom:tenantId": "agency-42"},
            body={"name": "Contacto ficticio", "type": "prospecto"},
        ), None)
        self.model_response = {"output": {"message": {"content": [{
            "toolUse": {"name": "list_records", "input": {"entity": "contacts"}}
        }]}}}
        result = lambda_handler(self.assistant_event("Lista mis contactos"), None)
        body = json.loads(result["body"])
        self.assertEqual(result["statusCode"], 200)
        self.assertEqual(body["records"][0]["name"], "Contacto ficticio")
        self.assertEqual(body["records"][0]["id"], self.table.transactions[0][0]["Put"]["Item"]["entityKey"]["S"].split("#")[1])

    def test_assistant_proposes_update_only_for_existing_record(self):
        created = lambda_handler(self.event(
            method="POST",
            claims={"sub": "user-7", "custom:tenantId": "agency-42"},
            body={"name": "Contacto ficticio", "type": "prospecto"},
        ), None)
        contact_id = json.loads(created["body"])["id"]
        self.model_response = {"output": {"message": {"content": [{
            "toolUse": {
                "name": "update_record",
                "input": {"entity": "contacts", "id": contact_id, "data": {"name": "Contacto actualizado"}},
            }
        }]}}}
        result = lambda_handler(self.assistant_event("Cambia el nombre del contacto"), None)
        body = json.loads(result["body"])
        self.assertEqual(result["statusCode"], 200)
        self.assertEqual(body["action"]["kind"], "update")
        self.assertEqual(body["action"]["id"], contact_id)
        self.assertEqual(len(self.table.transactions), 1)

    def test_assistant_rejects_empty_bedrock_response(self):
        self.model_response = {"output": {"message": {"content": []}}}
        result = lambda_handler(self.assistant_event("Hola"), None)
        self.assertEqual(result["statusCode"], 502)
        self.assertEqual(json.loads(result["body"])["error"], "Bad Gateway")

    def test_assistant_validates_tool_data_before_proposing_action(self):
        self.model_response = {"output": {"message": {"content": [{
            "toolUse": {
                "name": "create_record",
                "input": {"entity": "products", "data": {"name": "Producto sin categoría"}},
            }
        }]}}}
        result = lambda_handler(self.assistant_event("Crea un producto"), None)
        self.assertEqual(result["statusCode"], 400)
        self.assertEqual(self.table.transactions, [])

    def test_rejects_unknown_fields(self):
        result = lambda_handler(self.event(
            method="POST",
            claims={"sub": "user-7", "custom:tenantId": "agency-42"},
            body={"name": "María López", "type": "cliente", "tenantId": "other-agency"},
        ), None)
        self.assertEqual(result["statusCode"], 400)
        self.assertEqual(self.table.transactions, [])

    def test_normalizes_stage_and_limits_cors_origin(self):
        result = lambda_handler(self.event(claims={"sub": "user-7", "custom:tenantId": "agency-42"}), None)
        self.assertEqual(result["statusCode"], 200)
        self.assertEqual(result["headers"]["Access-Control-Allow-Origin"], "https://main.dr86wkdl0o11b.amplifyapp.com")

    def test_options_returns_cors_preflight_headers_without_authentication(self):
        result = lambda_handler(self.event(method="OPTIONS"), None)
        self.assertEqual(result["statusCode"], 204)
        self.assertEqual(result["headers"]["Access-Control-Allow-Methods"], "GET,POST,PATCH,DELETE,OPTIONS")

    def test_rejects_non_string_contact_type_as_bad_request(self):
        result = lambda_handler(self.event(
            method="POST",
            claims={"sub": "user-7", "custom:tenantId": "agency-42"},
            body={"name": "María López", "type": ["cliente"]},
        ), None)
        self.assertEqual(result["statusCode"], 400)

    def test_creates_opportunity_with_decimal_safe_premium(self):
        result = lambda_handler(self.event(
            method="POST",
            claims={"sub": "user-7", "custom:tenantId": "agency-42"},
            path="/prod/v1/opportunities",
            body={
                "name": "Renovación empresarial",
                "contactId": "contact-1",
                "stage": "cotizando",
                "premium": 1250.5,
            },
        ), None)
        saved = json.loads(result["body"])
        self.assertEqual(result["statusCode"], 201)
        self.assertEqual(saved["entityKey"].split("#", 1)[0], "OPPORTUNITY")
        item = self.table.transactions[0][0]["Put"]["Item"]
        self.assertEqual(item["premium"]["N"], "1250.5")

    def test_validates_module_specific_fields(self):
        result = lambda_handler(self.event(
            method="POST",
            claims={"sub": "user-7", "custom:tenantId": "agency-42"},
            path="/prod/v1/policies",
            body={
                "policyNumber": "POL-100",
                "contactId": "contact-1",
                "insurerId": "insurer-1",
                "premium": -10,
                "startDate": "2026-01-01",
                "endDate": "2027-01-01",
                "status": "activa",
            },
        ), None)
        self.assertEqual(result["statusCode"], 400)
        self.assertEqual(self.table.transactions, [])

    def test_archives_contact_and_keeps_audit_record(self):
        created = lambda_handler(self.event(
            method="POST",
            claims={"sub": "user-7", "custom:tenantId": "agency-42"},
            body={"name": "María López", "type": "cliente"},
        ), None)
        contact_id = json.loads(created["body"])["id"]
        archived = lambda_handler(self.event(
            method="DELETE",
            path=f"/prod/v1/contacts/{contact_id}",
            claims={"sub": "user-7", "custom:tenantId": "agency-42"},
        ), None)
        self.assertEqual(archived["statusCode"], 204)
        record = self.table.items[("agency-42", f"CONTACT#{contact_id}")]
        self.assertTrue(record["archived"])
        self.assertEqual(record["status"], "inactivo")
        audit_records = [item for item in self.table.items.values() if item["entityKey"].startswith("AUDIT#")]
        self.assertEqual(len(audit_records), 2)

    def test_exposes_all_business_resources(self):
        response = lambda_handler({"httpMethod": "GET", "path": "/v1/docs", "headers": {}}, None)
        documented = json.loads(response["body"])["paths"]
        for resource in ("contacts", "insurers", "products", "opportunities", "quotes", "policies", "renewals", "claims", "tasks", "documents", "agencies", "users"):
            self.assertIn(f"/v1/{resource}", documented)
        self.assertIn("/v1/assistant", documented)

    def test_lists_only_contacts_in_authenticated_tenant(self):
        for tenant_id, name in (("agency-42", "Contacto propio"), ("agency-99", "Contacto ajeno")):
            lambda_handler(self.event(
                method="POST",
                claims={"sub": "user-7", "custom:tenantId": tenant_id},
                body={"name": name, "type": "cliente"},
            ), None)
        result = lambda_handler(self.event(claims={"sub": "user-7", "custom:tenantId": "agency-42"}), None)
        listed = json.loads(result["body"])
        self.assertEqual(result["statusCode"], 200)
        self.assertEqual([row["name"] for row in listed], ["Contacto propio"])

    def test_reports_count_active_records_by_resource(self):
        lambda_handler(self.event(
            method="POST",
            claims={"sub": "user-7", "custom:tenantId": "agency-42"},
            body={"name": "Contacto propio", "type": "cliente"},
        ), None)
        result = lambda_handler(self.event(
            path="/prod/v1/reports",
            claims={"sub": "user-7", "custom:tenantId": "agency-42"},
        ), None)
        report = json.loads(result["body"])
        self.assertEqual(result["statusCode"], 200)
        self.assertEqual(report["counts"]["contacts"], 1)
        self.assertEqual(report["counts"]["policies"], 0)


class FakeKey:
    def __init__(self, name):
        self.name = name

    def eq(self, value):
        return FakeCondition(("eq", self.name, value))

    def begins_with(self, value):
        return FakeCondition(("begins_with", self.name, value))

    def __and__(self, other):
        return FakeCondition((self, other))


class FakeCondition:
    def __init__(self, value):
        self.value = value

    def __and__(self, other):
        return FakeCondition((self.value, other.value))


class FakeSerializer:
    def serialize(self, value):
        if isinstance(value, str):
            return {"S": value}
        if isinstance(value, bool):
            return {"BOOL": value}
        if isinstance(value, (int, float)):
            return {"N": str(value)}
        if isinstance(value, Decimal):
            return {"N": str(value)}
        if value is None:
            return {"NULL": True}
        raise TypeError(f"Unsupported test value: {value!r}")


def _deserialize(item):
    if not isinstance(item, dict):
        return item
    return {key: _deserialize_value(value) for key, value in item.items()}


def _deserialize_value(value):
    if "S" in value:
        return value["S"]
    if "N" in value:
        number = Decimal(value["N"])
        return int(number) if number % 1 == 0 else number
    if "BOOL" in value:
        return value["BOOL"]
    if "NULL" in value:
        return None
    raise TypeError(f"Unsupported test attribute: {value!r}")


def _condition_values(condition):
    tenant_id = None
    prefix = None
    value = getattr(condition, "value", None)
    if isinstance(value, tuple):
        for part in value:
            part_tenant, part_prefix = _condition_values(types.SimpleNamespace(value=part))
            tenant_id = tenant_id or part_tenant
            prefix = prefix or part_prefix
        if len(value) == 3 and value[0] == "eq" and value[1] == "tenantId":
            tenant_id = value[2]
        if len(value) == 3 and value[0] == "begins_with" and value[1] == "entityKey":
            prefix = value[2]
    return tenant_id, prefix


if __name__ == "__main__":
    unittest.main()
