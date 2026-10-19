import { defineBackend } from "@aws-amplify/backend";
import { RemovalPolicy, Stack } from "aws-cdk-lib";
import {
  AuthorizationType,
  CognitoUserPoolsAuthorizer,
  Cors,
  LambdaIntegration,
  RestApi,
} from "aws-cdk-lib/aws-apigateway";
import { AttributeType, BillingMode, Table, TableEncryption } from "aws-cdk-lib/aws-dynamodb";
import { auth } from "./auth/resource.ts";
import { api } from "./functions/api/resource.ts";

const backend = defineBackend({
  auth,
  api,
});

const apiStack = backend.createStack("BrukizAmsApi");
const dataTable = new Table(apiStack, "BrukizAmsData", {
  tableName: `BrukizAmsData-${apiStack.stackName}`,
  partitionKey: { name: "tenantId", type: AttributeType.STRING },
  sortKey: { name: "entityKey", type: AttributeType.STRING },
  billingMode: BillingMode.PAY_PER_REQUEST,
  encryption: TableEncryption.AWS_MANAGED,
  pointInTimeRecovery: true,
  removalPolicy: RemovalPolicy.RETAIN,
});

const apiFunction = backend.api.resources.lambda;
dataTable.grantReadWriteData(apiFunction);
const lambdaResource = backend.api.resources.cfnResources.cfnFunction;
lambdaResource.addPropertyOverride("Environment.Variables.TABLE_NAME", dataTable.tableName);
lambdaResource.addPropertyOverride("Environment.Variables.TENANT_CLAIM", "custom:tenantId");

const restApi = new RestApi(apiStack, "BrukizAmsRestApi", {
  restApiName: "Brukiz AMS API",
});
const authorizer = new CognitoUserPoolsAuthorizer(apiStack, "BrukizAmsAuthorizer", {
  cognitoUserPools: [backend.auth.resources.userPool],
});

const proxy = restApi.root.addProxy({
  defaultIntegration: new LambdaIntegration(apiFunction),
  anyMethod: true,
  defaultMethodOptions: {
    authorizer,
    authorizationType: AuthorizationType.COGNITO,
  },
});
proxy.addCorsPreflight({
  allowOrigins: Cors.ALL_ORIGINS,
  allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowHeaders: ["Authorization", "Content-Type"],
});

backend.addOutput({
  custom: {
    api: {
      endpoint: restApi.url,
      region: Stack.of(restApi).region,
    },
  },
});
