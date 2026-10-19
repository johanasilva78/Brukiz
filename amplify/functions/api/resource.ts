import { defineFunction } from "@aws-amplify/backend";
import { fileURLToPath } from "node:url";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";

export const api = defineFunction((scope) =>
  new NodejsFunction(scope, "BrukizAmsApiLambda", {
    entry: fileURLToPath(new URL("./handler.ts", import.meta.url)),
    handler: "handler",
    runtime: Runtime.NODEJS_22_X,
    bundling: {
      minify: true,
      externalModules: [
        "@nestjs/microservices",
        "@nestjs/websockets",
        "class-transformer/storage",
      ],
    },
  }),
);
