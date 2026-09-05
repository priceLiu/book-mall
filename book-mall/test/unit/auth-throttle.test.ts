import { afterEach, describe, expect, it } from "vitest";

import {
  AuthThrottleError,
  LOGIN_FAIL_IP,
  SMS_BURST_IP,
  assertNotThrottled,
  consumeRateLimit,
  recordThrottleHit,
  resetAuthThrottleForTests,
} from "@/lib/auth/auth-throttle";

describe("auth-throttle", () => {
  afterEach(() => {
    resetAuthThrottleForTests();
  });

  it("allows under the window then blocks", () => {
    for (let i = 0; i < LOGIN_FAIL_IP.max; i++) {
      assertNotThrottled("t:ip", LOGIN_FAIL_IP);
      recordThrottleHit("t:ip", LOGIN_FAIL_IP);
    }
    expect(() => assertNotThrottled("t:ip", LOGIN_FAIL_IP)).toThrow(AuthThrottleError);
  });

  it("sms burst consumeRateLimit returns true when exceeded", () => {
    for (let i = 0; i < SMS_BURST_IP.max; i++) {
      expect(consumeRateLimit("sms:ip:1.1.1.1", SMS_BURST_IP)).toBe(false);
    }
    expect(consumeRateLimit("sms:ip:1.1.1.1", SMS_BURST_IP)).toBe(true);
  });
});
