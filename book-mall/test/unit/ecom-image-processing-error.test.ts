import { describe, expect, it } from "vitest";

import { formatEcomImageProcessingUserError } from "@/lib/ecom/ecom-image-processing-error";

describe("formatEcomImageProcessingUserError", () => {
  it("maps DashScope free quota exceeded to Chinese hint", () => {
    const out = formatEcomImageProcessingUserError(
      new Error("Freefallocatedquotaexceeded."),
    );
    expect(out.status).toBe(402);
    expect(out.message).toContain("免费额度");
    expect(out.message).not.toContain("Freefallocated");
  });

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

  it("maps Buffer.from(undefined) to a selection-data hint", () => {
    const out = formatEcomImageProcessingUserError(
      new Error(
        "The first argument must be of type string or an instance of Buffer, ArrayBuffer, Array, or Array-like Object. Received undefined",
      ),
    );
    expect(out.status).toBe(400);
    expect(out.message).toContain("选区或底图数据不完整");
  });

  it("passes through gateway key errors with 402", () => {
    const out = formatEcomImageProcessingUserError(
      new Error("Gateway Key 未绑定火山方舟凭证"),
    );
    expect(out.status).toBe(402);
    expect(out.message).toContain("Gateway Key");
  });
});
