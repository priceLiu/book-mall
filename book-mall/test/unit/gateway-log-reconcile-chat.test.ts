import { describe, expect, it } from "vitest";

import {
  hasAssistantReplyAfterGatewayLog,
  parseEcomClientPage,
} from "@/lib/gateway/gateway-log-reconcile";

describe("parseEcomClientPage", () => {
  it("parses ecom client page path", () => {
    expect(
      parseEcomClientPage("ecom/user-1/proj-1/ecom-toolkit__storyboard"),
    ).toEqual({
      userId: "user-1",
      workspaceId: "proj-1",
      toolKey: "ecom-toolkit__storyboard",
    });
  });

  it("returns null for non-ecom pages", () => {
    expect(parseEcomClientPage("canvas/foo")).toBeNull();
    expect(parseEcomClientPage(null)).toBeNull();
  });
});

describe("hasAssistantReplyAfterGatewayLog", () => {
  const submittedAt = new Date("2026-03-24T04:42:38.000Z");

  it("detects assistant message after log submit", () => {
    expect(
      hasAssistantReplyAfterGatewayLog(
        [
          {
            role: "assistant",
            content: "卖点清单已生成",
            createdAt: "2026-03-24T04:43:00.000Z",
          },
        ],
        submittedAt,
      ),
    ).toBe(true);
  });

  it("ignores empty or pre-submit assistant messages", () => {
    expect(
      hasAssistantReplyAfterGatewayLog(
        [{ role: "assistant", content: "  ", createdAt: "2026-03-24T04:43:00.000Z" }],
        submittedAt,
      ),
    ).toBe(false);
    expect(
      hasAssistantReplyAfterGatewayLog(
        [{ role: "assistant", content: "old", createdAt: "2026-03-24T04:40:00.000Z" }],
        submittedAt,
      ),
    ).toBe(false);
  });
});
