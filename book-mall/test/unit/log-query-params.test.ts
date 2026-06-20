import { describe, expect, it } from "vitest";

import {
  computeLogTotalPages,
  GATEWAY_LOG_PAGE_SIZE_DEFAULT,
  GATEWAY_LOG_PAGE_SIZE_MAX,
  parseLogLimitParam,
  parseLogPageParam,
} from "@/lib/gateway/log-query-params";

describe("log-query-params pagination", () => {
  it("parseLogPageParam defaults and clamps invalid", () => {
    expect(parseLogPageParam(null)).toBe(1);
    expect(parseLogPageParam("0")).toBe(1);
    expect(parseLogPageParam("2.9")).toBe(2);
  });

  it("parseLogLimitParam respects max", () => {
    expect(parseLogLimitParam(null)).toBe(GATEWAY_LOG_PAGE_SIZE_DEFAULT);
    expect(parseLogLimitParam("50")).toBe(50);
    expect(parseLogLimitParam(String(GATEWAY_LOG_PAGE_SIZE_MAX + 100))).toBe(
      GATEWAY_LOG_PAGE_SIZE_MAX,
    );
  });

  it("computeLogTotalPages", () => {
    expect(computeLogTotalPages(0, 20)).toBe(1);
    expect(computeLogTotalPages(41, 20)).toBe(3);
    expect(computeLogTotalPages(20, 20)).toBe(1);
  });
});
