import base64
import binascii
import json
import logging
import os
import re
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any
from urllib.parse import unquote

logger = logging.getLogger()
logger.setLevel(logging.INFO)

CONTACT_TYPES = {"prospecto", "cliente", "asegurado", "beneficiario", "representante"}
CONTACT_STATUSES = {"activo", "seguimiento", "nuevo", "inactivo"}
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
DEFAULT_CORS_ORIGIN = "https://main.dr86wkdl0o11b.amplifyapp.com"
ENTITIES = {
    "contacts": ("CONTACT", {
        "name": ("text", 160, True), "email": ("email", 254, False),
        "phone": ("text", 40, False), "type": ("enum", CONTACT_TYPES, True),
        "company": ("text", 180, False), "status": ("enum", CONTACT_STATUSES, False),
    }),
    "insurers": ("INSURER", {
        "name": ("text", 160, True), "email": ("email", 254, False),
        "phone": ("text", 40, False), "website": ("text", 300, False),
        "status": ("enum", {"activo", "inactivo"}, False), "notes": ("text", 2000, False),
    }),
    "products": ("PRODUCT", {
        "name": ("text", 160, True), "insurerId": ("text", 64, False),
        "category": ("text", 80, True), "description": ("text", 2000, False),
        "status": ("enum", {"activo", "inactivo"}, False),
    }),
    "opportunities": ("OPPORTUNITY", {
        "name": ("text", 160, True), "contactId": ("text", 64, True),
        "productId": ("text", 64, False), "insurerId": ("text", 64, False),
        "premium": ("number", 0, False), "stage": ("enum", {"nuevo", "contactado", "cotizando", "negociacion", "ganada", "perdida"}, True),
        "expectedCloseDate": ("date", 0, False), "notes": ("text", 2000, False),
    }),
    "quotes": ("QUOTE", {
        "opportunityId": ("text", 64, True), "insurerId": ("text", 64, True),
        "productId": ("text", 64, False), "premium": ("number", 0, True),
        "currency": ("enum", {"HNL", "USD"}, False),
        "status": ("enum", {"solicitada", "recibida", "presentada", "aceptada", "rechazada", "vencida"}, True),
        "validUntil": ("date", 0, False), "notes": ("text", 2000, False),
    }),
    "policies": ("POLICY", {
        "policyNumber": ("text", 80, True), "contactId": ("text", 64, True),
        "insurerId": ("text", 64, True), "productId": ("text", 64, False),
        "premium": ("number", 0, True), "currency": ("enum", {"HNL", "USD"}, False),
        "startDate": ("date", 0, True), "endDate": ("date", 0, True),
        "status": ("enum", {"activa", "vencida", "cancelada"}, True),
    }),
    "renewals": ("RENEWAL", {
        "policyId": ("text", 64, True), "contactId": ("text", 64, True),
        "dueDate": ("date", 0, True), "premium": ("number", 0, False),
        "status": ("enum", {"pendiente", "en_gestion", "renovada", "no_renovada"}, True),
        "notes": ("text", 2000, False),
    }),
    "claims": ("CLAIM", {
        "policyId": ("text", 64, True), "contactId": ("text", 64, True),
        "claimNumber": ("text", 80, False), "reportedAt": ("date", 0, True),
        "amount": ("number", 0, False),
        "status": ("enum", {"reportado", "en_revision", "aprobado", "rechazado", "cerrado"}, True),
        "description": ("text", 3000, True), "notes": ("text", 2000, False),
    }),
    "tasks": ("TASK", {
        "title": ("text", 180, True), "dueDate": ("date", 0, False),
        "priority": ("enum", {"baja", "media", "alta"}, True),
        "status": ("enum", {"pendiente", "en_progreso", "completada"}, True),
        "relatedType": ("enum", {"contact", "opportunity", "policy", "claim", "renewal"}, False),
        "relatedId": ("text", 64, False), "assignee": ("text", 160, False),
        "description": ("text", 2000, False),
    }),
    "documents": ("DOCUMENT", {
        "name": ("text", 180, True), "relatedType": ("enum", {"contact", "opportunity", "quote", "policy", "claim"}, False),
        "relatedId": ("text", 64, False), "fileName": ("text", 255, False),
        "mimeType": ("text", 120, False), "notes": ("text", 2000, False),
    }),
    "agencies": ("AGENCY", {
        "name": ("text", 180, True), "email": ("email", 254, False),
        "phone": ("text", 40, False), "address": ("text", 300, False),
    }),
    "users": ("USER", {
        "name": ("text", 160, True), "email": ("email", 254, True),
        "role": ("enum", {"administrador", "agente", "consulta"}, True),
        "status": ("enum", {"activo", "inactivo"}, True),
    }),
}
STATUS_DEFAULTS = {
    "contacts": "nuevo", "insurers": "activo", "products": "activo",
    "opportunities": "nuevo", "quotes": "solicitada", "policies": "activa",
    "renewals": "pendiente", "claims": "reportado", "tasks": "pendiente",
    "users": "activo",
}


class ApiError(Exception):
    def __init__(self, status_code: int, message: str, error: str) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.message = message
        self.error = error


def response(status_code: int, body: Any = None, origin: str | None = None) -> dict[str, Any]:
    headers = {"Content-Type": "application/json"}
    allowed_origin = os.environ.get("CORS_ORIGIN", DEFAULT_CORS_ORIGIN)
    if origin and origin == allowed_origin:
        headers["Access-Control-Allow-Origin"] = allowed_origin
        headers["Vary"] = "Origin"
        if status_code == 204:
            headers["Access-Control-Allow-Methods"] = "GET,POST,PATCH,DELETE,OPTIONS"
            headers["Access-Control-Allow-Headers"] = "Authorization,Content-Type"
            headers["Access-Control-Max-Age"] = "600"
    return {
        "statusCode": status_code,
        "headers": headers,
        "body": "" if body is None else json.dumps(body, default=_json_default),
        "isBase64Encoded": False,
    }


def _json_default(value: Any) -> Any:
    if isinstance(value, Decimal):
        return int(value) if value % 1 == 0 else float(value)
    raise TypeError(f"Cannot serialize {type(value).__name__}")


def _tenant_and_actor(event: dict[str, Any]) -> tuple[str, str]:
    request_context = event.get("requestContext") or {}
    authorizer = request_context.get("authorizer") or {}
    claims = authorizer.get("claims") or (authorizer.get("jwt") or {}).get("claims") or {}
    tenant_claim = os.environ.get("TENANT_CLAIM", "custom:tenantId")
    tenant_id = claims.get(tenant_claim)
    actor_id = claims.get("sub")
    if os.environ.get("DEMO_MODE", "").lower() == "true":
        return "demo", "demo-user"
    if not tenant_id or not actor_id:
        raise ApiError(403, "La sesión no contiene un tenant y usuario válidos.", "Forbidden")
    return str(tenant_id), str(actor_id)


def _normalized_path(event: dict[str, Any]) -> str:
    request_context = event.get("requestContext") or {}
    path = event.get("rawPath") or event.get("path") or "/"
    stage = request_context.get("stage")
    prefix = f"/{stage}" if stage and stage != "$default" else None
    if prefix and (path == prefix or path.startswith(f"{prefix}/")):
        path = path[len(prefix):] or "/"
    return path.rstrip("/") or "/"


def _request_body(event: dict[str, Any]) -> dict[str, Any]:
    body = event.get("body")
    if body is None:
        return {}
    if event.get("isBase64Encoded"):
        try:
            body = base64.b64decode(body, validate=True).decode("utf-8")
        except (binascii.Error, UnicodeDecodeError, ValueError) as exc:
            raise ApiError(400, "El cuerpo de la solicitud codificado no es válido.", "Bad Request") from exc
    try:
        parsed = json.loads(body) if isinstance(body, str) else body
    except (json.JSONDecodeError, UnicodeDecodeError, ValueError) as exc:
        raise ApiError(400, "El cuerpo de la solicitud debe ser JSON válido.", "Bad Request") from exc
    if not isinstance(parsed, dict):
        raise ApiError(400, "El cuerpo de la solicitud debe ser un objeto JSON.", "Bad Request")
    return parsed


def _validate_entity(entity_name: str, data: dict[str, Any], *, create: bool) -> dict[str, Any]:
    fields = ENTITIES[entity_name][1]
    allowed = set(fields)
    unknown = set(data) - allowed
    if unknown:
        raise ApiError(400, f"Propiedades no permitidas: {', '.join(sorted(unknown))}.", "Bad Request")
    if not create and not data:
        raise ApiError(400, "Debe proporcionar al menos un campo para actualizar.", "Bad Request")

    for name, (kind, constraint, required) in fields.items():
        value = data.get(name)
        if create and required and (value is None or value == ""):
            raise ApiError(400, f"El campo {name} es obligatorio.", "Bad Request")
        if value is None:
            continue
        if kind == "text" and (not isinstance(value, str) or len(value) > constraint):
            raise ApiError(400, f"El campo {name} debe ser texto de hasta {constraint} caracteres.", "Bad Request")
        if kind == "email" and (not isinstance(value, str) or len(value) > constraint or not EMAIL_PATTERN.fullmatch(value)):
            raise ApiError(400, f"El campo {name} debe contener un correo válido.", "Bad Request")
        if kind == "enum" and (not isinstance(value, str) or value not in constraint):
            raise ApiError(400, f"El valor del campo {name} no es válido.", "Bad Request")
        if kind == "number" and (
            isinstance(value, bool) or not isinstance(value, (int, float)) or value < 0
        ):
            raise ApiError(400, f"El campo {name} debe ser un número no negativo.", "Bad Request")
        if kind == "date" and (
            not isinstance(value, str)
            or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value)
        ):
            raise ApiError(400, f"El campo {name} debe usar el formato YYYY-MM-DD.", "Bad Request")
        if kind == "date":
            try:
                datetime.strptime(value, "%Y-%m-%d")
            except ValueError as exc:
                raise ApiError(400, f"El campo {name} no es una fecha válida.", "Bad Request") from exc
    return data


def _table():
    table_name = os.environ.get("TABLE_NAME")
    if not table_name:
        raise RuntimeError("La variable TABLE_NAME no está configurada.")
    import boto3

    return boto3.resource("dynamodb").Table(table_name)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _audit(tenant_id: str, actor_id: str, action: str, entity_type: str, entity_id: str, occurred_at: str) -> dict[str, Any]:
    return {
        "tenantId": tenant_id,
        "entityKey": f"AUDIT#{occurred_at}#{uuid.uuid4()}",
        "actorId": actor_id,
        "action": action,
        "entityType": entity_type,
        "entityId": entity_id,
        "occurredAt": occurred_at,
        "result": "SUCCESS",
    }


def _transact(table, writes: list[dict[str, Any]]) -> None:
    table.meta.client.transact_write_items(TransactItems=writes)


def _dynamo_item(item: dict[str, Any]) -> dict[str, Any]:
    from boto3.dynamodb.types import TypeSerializer

    serializer = TypeSerializer()
    return {key: serializer.serialize(_to_dynamo_value(value)) for key, value in item.items()}


def _to_dynamo_value(value: Any) -> Any:
    if isinstance(value, float):
        return Decimal(str(value))
    if isinstance(value, list):
        return [_to_dynamo_value(item) for item in value]
    if isinstance(value, dict):
        return {key: _to_dynamo_value(item) for key, item in value.items()}
    return value


def _list_entities(table, tenant_id: str, entity_name: str, include_archived: bool = False) -> list[dict[str, Any]]:
    from boto3.dynamodb.conditions import Key

    entity_type = ENTITIES[entity_name][0]
    items: list[dict[str, Any]] = []
    query: dict[str, Any] = {
        "KeyConditionExpression": Key("tenantId").eq(tenant_id) & Key("entityKey").begins_with(f"{entity_type}#")
    }
    while True:
        result = table.query(**query)
        items.extend(
            item for item in result.get("Items", [])
            if include_archived or not item.get("archived", False)
        )
        last_key = result.get("LastEvaluatedKey")
        if not last_key:
            return items
        query["ExclusiveStartKey"] = last_key


def _get_entity(table, tenant_id: str, entity_name: str, entity_id: str) -> dict[str, Any]:
    entity_type = ENTITIES[entity_name][0]
    result = table.get_item(Key={"tenantId": tenant_id, "entityKey": f"{entity_type}#{entity_id}"}, ConsistentRead=True)
    item = result.get("Item")
    if not item or item.get("archived"):
        raise ApiError(404, "No se encontró el registro.", "Not Found")
    return item


def _create_entity(table, tenant_id: str, actor_id: str, entity_name: str, data: dict[str, Any]) -> dict[str, Any]:
    now = _now()
    entity_type = ENTITIES[entity_name][0]
    entity_id = str(uuid.uuid4())
    entity = {
        **data,
        "id": entity_id,
        "entityType": entity_type,
        "tenantId": tenant_id,
        "entityKey": f"{entity_type}#{entity_id}",
        "createdAt": now,
        "updatedAt": now,
    }
    if entity_name in STATUS_DEFAULTS:
        entity["status"] = entity.get("status", STATUS_DEFAULTS[entity_name])
    _transact(table, [
        {"Put": {"TableName": table.name, "Item": _dynamo_item(entity)}},
        {"Put": {"TableName": table.name, "Item": _dynamo_item(_audit(tenant_id, actor_id, f"{entity_type}_CREATED", entity_type, entity_id, now))}},
    ])
    return entity


def _update_entity(table, tenant_id: str, actor_id: str, entity_name: str, entity_id: str, data: dict[str, Any]) -> dict[str, Any]:
    _get_entity(table, tenant_id, entity_name, entity_id)
    now = _now()
    fields = {**data, "updatedAt": now}
    expression_names = {f"#field{index}": key for index, key in enumerate(fields)}
    expression_values = {f":value{index}": value for index, value in enumerate(fields.values())}
    update_expression = "SET " + ", ".join(
        f"#field{index} = :value{index}" for index in range(len(fields))
    )
    update = {
        "TableName": table.name,
        "Key": _dynamo_item({"tenantId": tenant_id, "entityKey": f"{ENTITIES[entity_name][0]}#{entity_id}"}),
        "UpdateExpression": update_expression,
        "ConditionExpression": "attribute_exists(tenantId) AND attribute_exists(entityKey)",
        "ExpressionAttributeNames": expression_names,
        "ExpressionAttributeValues": _dynamo_item(expression_values),
    }
    _transact(table, [
        {"Update": update},
        {"Put": {"TableName": table.name, "Item": _dynamo_item(_audit(
            tenant_id, actor_id, f"{ENTITIES[entity_name][0]}_UPDATED", ENTITIES[entity_name][0], entity_id, now
        ))}},
    ])
    result = table.get_item(
        Key={"tenantId": tenant_id, "entityKey": f"{ENTITIES[entity_name][0]}#{entity_id}"},
        ConsistentRead=True,
    )
    updated = result.get("Item")
    if not updated:
        raise RuntimeError("No se pudo recuperar el registro actualizado.")
    return updated


def _archive_entity(table, tenant_id: str, actor_id: str, entity_name: str, entity_id: str) -> None:
    entity = _get_entity(table, tenant_id, entity_name, entity_id)
    fields = {"archived": True, "updatedAt": _now()}
    status = entity.get("status")
    allowed_statuses = {
        "contacts": CONTACT_STATUSES, "insurers": {"activo", "inactivo"},
        "products": {"activo", "inactivo"}, "users": {"activo", "inactivo"},
    }
    if status and entity_name in allowed_statuses:
        fields["status"] = "inactivo"
    _update_entity(table, tenant_id, actor_id, entity_name, entity_id, fields)


def _reports(table, tenant_id: str) -> dict[str, Any]:
    counts: dict[str, int] = {}
    for entity_name in ENTITIES:
        counts[entity_name] = len(_list_entities(table, tenant_id, entity_name))
    return {"counts": counts, "generatedAt": _now()}


def _dispatch(event: dict[str, Any]) -> tuple[int, Any]:
    method = event.get("httpMethod") or (event.get("requestContext") or {}).get("http", {}).get("method", "")
    path = _normalized_path(event)
    if method == "OPTIONS":
        return 204, None
    if path == "/v1/docs":
        return 200, {
            "title": "Brukiz AMS API",
            "version": "1.0",
            "paths": {
                **{f"/v1/{resource}": {"get": {}, "post": {}} for resource in ENTITIES},
                **{f"/v1/{resource}/{{id}}": {"get": {}, "patch": {}, "delete": {}} for resource in ENTITIES},
                "/v1/reports": {"get": {}},
            },
        }
    if not path.startswith("/v1/"):
        raise ApiError(404, "No se encontró la ruta solicitada.", "Not Found")

    tenant_id, actor_id = _tenant_and_actor(event)
    table = _table()
    parts = [unquote(part) for part in path.removeprefix("/v1/").split("/") if part]
    if parts == ["reports"] and method == "GET":
        return 200, _reports(table, tenant_id)
    if not parts or parts[0] not in ENTITIES or len(parts) > 2:
        raise ApiError(404, "No se encontró la ruta solicitada.", "Not Found")

    entity_name = parts[0]
    if len(parts) == 1 and method == "GET":
        query = event.get("queryStringParameters") or {}
        return 200, _list_entities(table, tenant_id, entity_name, query.get("includeArchived") == "true")
    if len(parts) == 1 and method == "POST":
        data = _validate_entity(entity_name, _request_body(event), create=True)
        return 201, _create_entity(table, tenant_id, actor_id, entity_name, data)
    if len(parts) == 2 and method == "GET":
        return 200, _get_entity(table, tenant_id, entity_name, parts[1])
    if len(parts) == 2 and method == "PATCH":
        data = _validate_entity(entity_name, _request_body(event), create=False)
        return 200, _update_entity(table, tenant_id, actor_id, entity_name, parts[1], data)
    if len(parts) == 2 and method == "DELETE":
        _archive_entity(table, tenant_id, actor_id, entity_name, parts[1])
        return 204, None
    raise ApiError(404, "No se encontró la ruta solicitada.", "Not Found")


def lambda_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    origin = (event.get("headers") or {}).get("origin") or (event.get("headers") or {}).get("Origin")
    try:
        status_code, result = _dispatch(event)
        return response(status_code, result, origin)
    except ApiError as exc:
        return response(exc.status_code, {
            "message": exc.message,
            "error": exc.error,
            "statusCode": exc.status_code,
        }, origin)
    except Exception:
        logger.exception("Falló la solicitud del API Brukiz.")
        return response(500, {
            "message": "Ocurrió un error interno al procesar la solicitud.",
            "error": "Internal Server Error",
            "statusCode": 500,
        }, origin)
