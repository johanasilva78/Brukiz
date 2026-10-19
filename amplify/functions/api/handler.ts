import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import serverless from "serverless-http";
import { AppModule } from "./src/app.module";

const server = (async () => {
  const app = await NestFactory.create(AppModule, { logger: ["error", "warn"] });
  app.setGlobalPrefix("v1");
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }));
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle("Brukiz AMS API")
      .setDescription("API REST para la administración de agencias de seguros.")
      .setVersion("1.0")
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup("v1/docs", app, document);
  await app.init();
  return serverless(app.getHttpAdapter().getInstance());
})();

export const handler = async (event: object, context: object) =>
  (await server)(event, context);
