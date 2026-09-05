import { describe, expect, it } from "vitest";

import {
  PLATFORM_ASSISTANT_BILLING_USER_ID,
  PLATFORM_ASSISTANT_BILLING_USER_LABEL,
  buildPlatformAssistantGatewayLogWhere,
  isPlatformAssistantClientPage,
} from "@/lib/platform-assistant/platform-assistant-billing";

describe("platform-assistant-billing", () => {
  it("detects platform-assistant client pages", () => {
    expect(isPlatformAssistantClientPage("platform-assistant/chat")).toBe(true);
    expect(isPlatformAssistantClientPage("platform-assistant/ai-news-generate")).toBe(
      true,
    );
    expect(isPlatformAssistantClientPage("canvas/chat")).toBe(false);
    expect(isPlatformAssistantClientPage(null)).toBe(false);
  });

  it("uses stable virtual billing user id", () => {
    expect(PLATFORM_ASSISTANT_BILLING_USER_ID).toBe("platform-assistant");
    expect(PLATFORM_ASSISTANT_BILLING_USER_LABEL).toBe("AI 小智");
  });

  it("builds gateway where with clientPage prefix", () => {
    const where = buildPlatformAssistantGatewayLogWhere({ status: "SUCCEEDED" });
    expect(where).toEqual({
      AND: [
        { clientPage: { startsWith: "platform-assistant/" } },
        { status: "SUCCEEDED" },
      ],
    });
  });
});
