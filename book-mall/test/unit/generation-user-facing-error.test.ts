import { describe, expect, it } from "vitest";

import {
  classifyGenerationUserFacingBucket,
  formatGenerationUserMessage,
  USER_MESSAGE_PLATFORM_BILLING,
  USER_MESSAGE_VENDOR_QUEUE,
} from "@private/generation-user-facing-error";

describe("generation user-facing taxonomy", () => {
  it("INSUFFICIENT_CREDITS → USER_CREDITS", () => {
    expect(
      classifyGenerationUserFacingBucket({
        failCode: "INSUFFICIENT_CREDITS",
        failMessage: "积分不足：余额 0，需要 10",
      }),
    ).toBe("USER_CREDITS");
  });

  it("402 prefix stripped in user credit copy", () => {
    expect(
      formatGenerationUserMessage({
        failCode: "INSUFFICIENT_CREDITS",
        failMessage:
          "402, 积分不足：余额 405.23，需要 450。请前往主站充值后重试。",
      }),
    ).toBe(
      "积分不足：余额 405.23，需要 450。请前往主站充值后重试。",
    );
  });

  it("prisma mislabel → PLATFORM_BILLING", () => {
    expect(
      classifyGenerationUserFacingBucket({
        failCode: "INSUFFICIENT_CREDITS",
        failMessage: "Transaction already closed",
      }),
    ).toBe("PLATFORM_BILLING");
    expect(
      formatGenerationUserMessage({
        failCode: "INSUFFICIENT_CREDITS",
        failMessage: "Transaction already closed",
      }),
    ).toBe(USER_MESSAGE_PLATFORM_BILLING);
  });

  it("429 → VENDOR_INPUT", () => {
    expect(
      classifyGenerationUserFacingBucket({
        failCode: "UPSTREAM_RATE_LIMIT",
        failMessage: "rate limit",
        httpStatus: 429,
      }),
    ).toBe("VENDOR_INPUT");
  });

  it("transient → VENDOR_QUEUE user copy", () => {
    expect(
      classifyGenerationUserFacingBucket({
        failCode: "UPSTREAM_TRANSIENT",
        failMessage: "fetch failed",
      }),
    ).toBe("VENDOR_QUEUE");
    expect(
      formatGenerationUserMessage({
        failCode: "UPSTREAM_TRANSIENT",
        failMessage: "fetch failed",
      }),
    ).toBe(USER_MESSAGE_VENDOR_QUEUE);
  });
});