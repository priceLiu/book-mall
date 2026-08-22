import { describe, expect, it } from "vitest";

import { sanitizeCheckoutReturnTo } from "@/lib/platform-billing/build-checkout-href";

describe("sanitizeCheckoutReturnTo", () => {
  const allowed = ["https://book.example.com", "https://cs.example.com"];

  it("allows same-site path", () => {
    expect(sanitizeCheckoutReturnTo("/canvas/abc", allowed)).toBe("/canvas/abc");
  });

  it("allows whitelisted absolute origin", () => {
    expect(
      sanitizeCheckoutReturnTo("https://cs.example.com/canvas/x", allowed),
    ).toBe("https://cs.example.com/canvas/x");
  });

  it("rejects external origin", () => {
    expect(
      sanitizeCheckoutReturnTo("https://evil.com/phish", allowed),
    ).toBeNull();
  });
});

describe("share reward config defaults", () => {
  it("qualifying order types include subscription and topup", async () => {
    const { QUALIFYING_FIRST_PAY_ORDER_TYPES } = await import(
      "@/lib/share/share-reward-config"
    );
    expect(QUALIFYING_FIRST_PAY_ORDER_TYPES).toContain("CREDIT_TOPUP");
    expect(QUALIFYING_FIRST_PAY_ORDER_TYPES).toContain("MEMBERSHIP");
  });

  it("workflow share redirect paths", async () => {
    const { workflowShareRedirectPath } = await import(
      "@/lib/share/workflow-share-service"
    );
    expect(workflowShareRedirectPath("CANVAS", "p1")).toBe("/canvas/p1");
    expect(workflowShareRedirectPath("ECOM", "p2")).toContain("projectId=p2");
    expect(workflowShareRedirectPath("QUICK_REPLICA", "t1")).toContain("templateId=t1");
  });
});
