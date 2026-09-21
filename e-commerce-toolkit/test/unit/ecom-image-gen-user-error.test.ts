import { describe, expect, it } from "vitest";

import { formatEcomImageGenUserMessage } from "@/lib/ecom-image-gen-user-error";

describe("formatEcomImageGenUserMessage", () => {
  it("maps Aliyun Arrearage JSON to balance hint", () => {
    const raw = JSON.stringify({
      error: {
        message: "Access denied, please make sure your account is in good standing.",
        type: "Arrearage",
        code: "Arrearage",
      },
    });
    expect(formatEcomImageGenUserMessage(raw)).toContain("欠费");
  });
});
