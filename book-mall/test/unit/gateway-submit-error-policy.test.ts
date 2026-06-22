import { describe, expect, it } from "vitest";

import { VolcengineUpstreamError } from "@/lib/gateway/volcengine-client";
import {
  classifyGatewaySubmitError,
  isContentPolicySubmitMessage,
  runGatewaySubmitWithRetry,
  buildSubmitFailureFinalizePayload,
} from "@/lib/gateway/gateway-submit-error-policy";

describe("gateway-submit-error-policy", () => {
  it("classifies content policy 400 as NON_RETRYABLE", () => {
    const e = new VolcengineUpstreamError(
      "火山方舟视频任务提交失败 (400): sensitive information",
      { status: 400, requestId: "req-1" },
    );
    const c = classifyGatewaySubmitError(e);
    expect(c.failCode).toBe("CONTENT_POLICY");
    expect(c.retryable).toBe(false);
    expect(c.class).toBe("NON_RETRYABLE");
  });

  it("classifies 429 as TRANSIENT retryable", () => {
    const e = new VolcengineUpstreamError("rate limit", { status: 429 });
    const c = classifyGatewaySubmitError(e);
    expect(c.failCode).toBe("UPSTREAM_TRANSIENT");
    expect(c.retryable).toBe(true);
  });

  it("classifies 404 as MODEL_NOT_FOUND", () => {
    const e = new VolcengineUpstreamError("model not found", { status: 404 });
    expect(classifyGatewaySubmitError(e).failCode).toBe("MODEL_NOT_FOUND");
  });

  it("retries transient then succeeds", async () => {
    let calls = 0;
    const result = await runGatewaySubmitWithRetry(
      async () => {
        calls++;
        if (calls < 2) {
          throw new VolcengineUpstreamError("503", { status: 503 });
        }
        return "task-ok";
      },
      { maxTransientAttempts: 3, delaysMs: [1, 1, 1] },
    );
    expect(result).toBe("task-ok");
    expect(calls).toBe(2);
  });

  it("does not retry content policy", async () => {
    let calls = 0;
    await expect(
      runGatewaySubmitWithRetry(async () => {
        calls++;
        throw new VolcengineUpstreamError("sensitive content", { status: 400 });
      }),
    ).rejects.toThrow(/sensitive/);
    expect(calls).toBe(1);
  });

  it("buildSubmitFailureFinalizePayload uses classified failCode", async () => {
    const payload = await buildSubmitFailureFinalizePayload(
      new VolcengineUpstreamError("sensitive information", {
        status: 400,
        requestId: "rid",
      }),
    );
    expect(payload.failCode).toBe("CONTENT_POLICY");
    expect(payload.failMessage).toContain("内容安全");
    expect(payload.vendorRequestId).toBe("rid");
  });

  it("classifies volcengine business error code in message as INVALID_INPUT", () => {
    const e = new VolcengineUpstreamError(
      "厂商返回任务提交错误 [错误码：40003]: invalid parameter",
      { status: 400, requestId: "req-volc" },
    );
    const c = classifyGatewaySubmitError(e);
    expect(c.failCode).toBe("INVALID_INPUT");
    expect(c.vendorRequestId).toBe("req-volc");
  });
});
