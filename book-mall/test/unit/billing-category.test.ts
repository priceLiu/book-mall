import { describe, expect, it } from "vitest";

import {
  BILLING_CATEGORY_LABEL,
  BILLING_CATEGORY_ORDER,
  billingCategoryLabel,
  classifyBillingCategory,
  resolveBillingCategory,
} from "@/lib/billing/billing-category";

describe("classifyBillingCategory — 七类", () => {
  it("maps billable kinds same as BYOK subset", () => {
    expect(classifyBillingCategory({ requestKind: "TRYON" })).toBe("TEXT_TO_IMAGE");
    expect(classifyBillingCategory({ requestKind: "TTS" })).toBe("TTS");
    expect(classifyBillingCategory({ requestKind: "VIDEO" })).toBe("IMAGE_TO_VIDEO");
    expect(
      classifyBillingCategory({
        requestKind: "VIDEO",
        inputSummary: { mode: "v2v" },
      }),
    ).toBe("VIDEO_TO_VIDEO");
    expect(
      classifyBillingCategory({
        requestKind: "CHAT",
        inputSummary: {
          input: {
            messages: [
              {
                role: "user",
                content: [{ type: "video_url", video_url: { url: "https://x/v.mp4" } }],
              },
            ],
          },
        },
      }),
    ).toBe("VIDEO_UNDERSTANDING");
  });

  it("pure CHAT → TEXT; OTHER → OTHER", () => {
    expect(classifyBillingCategory({ requestKind: "CHAT" })).toBe("TEXT");
    expect(classifyBillingCategory({ requestKind: "OTHER" })).toBe("OTHER");
  });

  it("BILLING_CATEGORY_ORDER has 7 entries with labels", () => {
    expect(BILLING_CATEGORY_ORDER).toHaveLength(7);
    for (const key of BILLING_CATEGORY_ORDER) {
      expect(BILLING_CATEGORY_LABEL[key]).toBeTruthy();
    }
  });

  it("resolveBillingCategory prefers persisted value", () => {
    const log = { requestKind: "TRYON" };
    expect(resolveBillingCategory(log, "TEXT_TO_IMAGE")).toBe("TEXT_TO_IMAGE");
    expect(resolveBillingCategory(log, null)).toBe("TEXT_TO_IMAGE");
  });

  it("billingCategoryLabel handles null", () => {
    expect(billingCategoryLabel(null)).toBe("—");
    expect(billingCategoryLabel("TEXT")).toBe("文字");
  });
});
