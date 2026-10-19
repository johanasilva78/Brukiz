import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { Request } from "express";
import { tenantIdFromRequest } from "./tenant-context";

function requestWithClaims(claims?: Record<string, string>): Request {
  return {
    apiGateway: {
      event: {
        requestContext: {
          authorizer: { claims },
        },
      },
    },
  } as unknown as Request;
}

describe("tenantIdFromRequest", () => {
  it("reads the tenant from the verified Cognito claim", () => {
    expect(tenantIdFromRequest(requestWithClaims({ "custom:tenantId": "agency-42" }))).toBe("agency-42");
  });

  it("rejects requests without a tenant claim", () => {
    expect(() => tenantIdFromRequest(requestWithClaims({ sub: "user-1" }))).toThrow(ForbiddenException);
  });
});
