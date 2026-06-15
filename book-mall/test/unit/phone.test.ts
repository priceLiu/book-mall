import { describe, expect, it } from "vitest";

import {
  isMockSmsPhone,
  isTestPrefixPhone,
  isValidCnPhone,
  maskPhone,
  MOCK_SMS_CODE,
  normalizePhone,
  TEST_PHONE_PREFIX,
} from "@/lib/auth/phone";

describe("normalizePhone", () => {
  it("accepts 11-digit mobile", () => {
    expect(normalizePhone("13800138000")).toBe("13800138000");
  });

  it("strips +86 prefix", () => {
    expect(normalizePhone("+8613800138000")).toBe("13800138000");
  });

  it("rejects invalid", () => {
    expect(normalizePhone("12345")).toBeNull();
  });

  it("accepts 67890 test prefix", () => {
    expect(normalizePhone("67890123456")).toBe("67890123456");
    expect(normalizePhone("+8667890123456")).toBe("67890123456");
    expect(normalizePhone("6789012345")).toBeNull();
    expect(normalizePhone("678901234567")).toBeNull();
  });
});

describe("maskPhone", () => {
  it("masks middle digits", () => {
    expect(maskPhone("13800138000")).toBe("138****8000");
  });
});

describe("mock sms phones", () => {
  it("detects test range", () => {
    expect(isMockSmsPhone("13800000001")).toBe(true);
    expect(isMockSmsPhone("13800138000")).toBe(false);
  });

  it("mock code constant", () => {
    expect(MOCK_SMS_CODE).toBe("888888");
  });

  it("valid cn phone", () => {
    expect(isValidCnPhone("13912345678")).toBe(true);
  });
});

describe("test prefix phones", () => {
  it("detects 67890 prefix", () => {
    expect(TEST_PHONE_PREFIX).toBe("67890");
    expect(isTestPrefixPhone("67890123456")).toBe(true);
    expect(isTestPrefixPhone("67890987654")).toBe(true);
    expect(isTestPrefixPhone("13800138000")).toBe(false);
  });
});
