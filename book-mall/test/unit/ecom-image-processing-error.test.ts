import { describe, expect, it } from "vitest";

import { formatEcomImageProcessingUserError } from "@/lib/ecom/ecom-image-processing-error";

describe("formatEcomImageProcessingUserError", () => {
  it("maps Seedream sensitive flag to Chinese content policy hint", () => {
    const out = formatEcomImageProcessingUserError(
      new Error(
        "The input or output was flagged as sensitive. Please try again with different inputs.",
      ),
    );
    expect(out.status).toBe(400);
    expect(out.message).toContain("安全策略");
    expect(out.message).not.toContain("flagged as sensitive");
  });

  it("passes through gateway key errors with 402", () => {
    const out = formatEcomImageProcessingUserError(
      new Error("Gateway Key 未绑定火山方舟凭证"),
    );
    expect(out.status).toBe(402);
    expect(out.message).toContain("Gateway Key");
  });
});
