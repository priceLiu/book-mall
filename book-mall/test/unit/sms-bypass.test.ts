import { describe, expect, it } from "vitest";

import {
  allowSmsBypassCode,
  isSmsBypassCode,
  isValidSmsCodeInput,
  verifySmsBypass,
} from "@/lib/auth/sms-bypass";

describe("sms-bypass", () => {
  it("accepts 6 letters + 2 digits in any order", () => {
    expect(isSmsBypassCode("abcdef12")).toBe(true);
    expect(isSmsBypassCode("ab12cdef")).toBe(true);
    expect(isSmsBypassCode("ABcdEF99")).toBe(true);
    expect(isSmsBypassCode("123456kn")).toBe(true);
    expect(isSmsBypassCode("12kn3456")).toBe(true);
  });

  it("rejects wrong lengths or charset", () => {
    expect(isSmsBypassCode("abcdef1")).toBe(false);
    expect(isSmsBypassCode("abcdef123")).toBe(false);
    expect(isSmsBypassCode("abcdefgh")).toBe(false);
    expect(isSmsBypassCode("12345678")).toBe(false);
  });

  it("valid input includes 6-digit or bypass", () => {
    expect(isValidSmsCodeInput("888888")).toBe(true);
    expect(isValidSmsCodeInput("abcdef12")).toBe(true);
    expect(isValidSmsCodeInput("123456kn")).toBe(true);
    expect(isValidSmsCodeInput("12345")).toBe(false);
  });

  it("allowSmsBypassCode defaults true unless env 0", () => {
    const prev = process.env.SMS_ALLOW_BYPASS_CODE;
    delete process.env.SMS_ALLOW_BYPASS_CODE;
    expect(allowSmsBypassCode()).toBe(true);
    process.env.SMS_ALLOW_BYPASS_CODE = "0";
    expect(allowSmsBypassCode()).toBe(false);
    if (prev === undefined) delete process.env.SMS_ALLOW_BYPASS_CODE;
    else process.env.SMS_ALLOW_BYPASS_CODE = prev;
  });

  it("67890 test phones pass with bypass even when global bypass disabled", () => {
    const prev = process.env.SMS_ALLOW_BYPASS_CODE;
    process.env.SMS_ALLOW_BYPASS_CODE = "0";
    expect(
      verifySmsBypass({ phoneNormalized: "67890123456", code: "abcdef12" }),
    ).toBe(true);
    expect(
      verifySmsBypass({ phoneNormalized: "13800138000", code: "abcdef12" }),
    ).toBe(false);
    if (prev === undefined) delete process.env.SMS_ALLOW_BYPASS_CODE;
    else process.env.SMS_ALLOW_BYPASS_CODE = prev;
  });
});
