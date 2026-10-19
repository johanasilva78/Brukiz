import { ForbiddenException } from "@nestjs/common";
import type { Request } from "express";

type GatewayRequest = Request & {
  apiGateway?: {
    event?: {
      requestContext?: {
        authorizer?: {
          claims?: Record<string, string | undefined>;
        };
      };
    };
  };
};

export function tenantIdFromRequest(request: Request): string {
  const claims = (request as GatewayRequest).apiGateway?.event?.requestContext?.authorizer?.claims;
  const tenantId = claims?.[process.env.TENANT_CLAIM ?? "custom:tenantId"];

  if (!tenantId) {
    throw new ForbiddenException("La sesión no contiene un tenant válido.");
  }

  return tenantId;
}
