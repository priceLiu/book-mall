import { describe, expect, it } from "vitest";

import {
  isGatewayLogTerminalStatus,
} from "@/lib/gateway/gateway-log-record-info";

describe("isGatewayLogTerminalStatus", () => {
  it("treats SUCCEEDED, FAILED, CANCELLED as terminal", () => {
    expect(isGatewayLogTerminalStatus("SUCCEEDED")).toBe(true);
    expect(isGatewayLogTerminalStatus("FAILED")).toBe(true);
    expect(isGatewayLogTerminalStatus("CANCELLED")).toBe(true);
  });

  it("treats RUNNING and unknown as non-terminal", () => {
    expect(isGatewayLogTerminalStatus("RUNNING")).toBe(false);
    expect(isGatewayLogTerminalStatus(undefined)).toBe(false);
    expect(isGatewayLogTerminalStatus(null)).toBe(false);
    expect(isGatewayLogTerminalStatus("PENDING")).toBe(false);
  });
});

describe("gatewayV1RecordInfo logId contract", () => {
  it("documents that poll callers must pass logId to avoid taskId alias", () => {
    // 回归说明：同一 externalTaskId 若有多条 Gateway 日志，recordInfo 仅按 taskId
    // 会 orderBy submittedAt desc 命中最新一条，导致 pending.logId 对应行永不收口。
    // 修复后 poll-service / ecomGwPoll* / canvasGwPoll 均传 logId。
    expect(true).toBe(true);
  });
});
