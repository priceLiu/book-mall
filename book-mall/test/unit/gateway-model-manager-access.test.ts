import { describe, expect, it } from "vitest";

import { canAccessGatewayModelManager } from "@/lib/gateway/gateway-model-manager-access";

describe("canAccessGatewayModelManager", () => {
  it("allows legacy BYOK persona", () => {
    expect(
      canAccessGatewayModelManager({
        email: "user@example.com",
        billingPersona: "BYOK",
      }),
    ).toBe(true);
  });

  it("allows platform pool delegate", () => {
    expect(
      canAccessGatewayModelManager({
        email: "admin@126.com",
        billingPersona: "PLATFORM_CREDIT",
        isPlatformPoolDelegate: true,
      }),
    ).toBe(true);
  });

  it("allows canonical platform pool owner without delegate flag", () => {
    expect(
      canAccessGatewayModelManager({
        email: "13808816802@126.com",
        billingPersona: "PLATFORM_CREDIT",
        bookRole: "USER",
      }),
    ).toBe(true);
  });

  it("allows configured platform gateway admin with ADMIN role", () => {
    expect(
      canAccessGatewayModelManager({
        email: "admin@126.com",
        billingPersona: "PLATFORM_CREDIT",
        bookRole: "ADMIN",
      }),
    ).toBe(true);
  });

  it("denies regular platform credit users", () => {
    expect(
      canAccessGatewayModelManager({
        email: "user@example.com",
        billingPersona: "PLATFORM_CREDIT",
        bookRole: "USER",
      }),
    ).toBe(false);
  });
});
