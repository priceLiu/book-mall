/**
 * 流式 Chat · 唯一收口包装（V1 route 必须挂上）。
 * 覆盖：正常结束 / 厂商 error / 读异常 / 客户端 cancel / 空闲与墙钟超时。
 */
import {
  chatStreamIdleMs,
  chatStreamWallMs,
} from "@/lib/gateway/gateway-health-policy";
import { buildGatewayStreamChatResultSummary } from "@/lib/gateway/log-result-summary";
import {
  finalizeRequestLog,
  parseOpenAiUsage,
  type UsageFromResponse,
} from "@/lib/gateway/proxy-common";

export type ChatStreamFinalizeCtx = {
  logId: string;
  model: string;
  startedAtMs: number;
};

function readWithIdle(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  idleMs: number,
): Promise<ReadableStreamReadResult<Uint8Array>> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      reject(Object.assign(new Error("流式输出长时间无数据"), { code: "STREAM_IDLE_TIMEOUT" }));
    }, idleMs);
    reader.read().then(
      (r) => {
        clearTimeout(t);
        resolve(r);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

export function wrapChatStreamWithLogFinalize(
  upstream: ReadableStream<Uint8Array>,
  ctx: ChatStreamFinalizeCtx,
): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  let buffer = "";
  let lastUsage: UsageFromResponse | undefined;
  let failMessage: string | undefined;
  let finalized = false;
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

  const finish = async (patch: {
    status: "SUCCEEDED" | "FAILED";
    failCode?: string;
    failMessage?: string;
  }) => {
    if (finalized || !ctx.logId) return;
    finalized = true;
    await finalizeRequestLog(ctx.logId, {
      status: patch.status,
      durationMs: Math.max(0, Date.now() - ctx.startedAtMs),
      usage: lastUsage,
      resultSummary: lastUsage
        ? buildGatewayStreamChatResultSummary(lastUsage)
        : undefined,
      failCode: patch.failCode,
      failMessage: patch.failMessage,
      model: ctx.model,
    }).catch((e) => {
      console.warn(
        "[gateway-chat-stream] finalize failed",
        ctx.logId,
        e instanceof Error ? e.message : e,
      );
    });
  };

  return new ReadableStream({
    async start(controller) {
      reader = upstream.getReader();
      const idleMs = chatStreamIdleMs();
      const wallMs = chatStreamWallMs();
      try {
        while (true) {
          if (Date.now() - ctx.startedAtMs > wallMs) {
            throw Object.assign(new Error("流式输出超过墙钟上限"), {
              code: "STREAM_WALL_TIMEOUT",
            });
          }
          const { done, value } = await readWithIdle(reader, idleMs);
          if (done) break;
          controller.enqueue(value);
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n");
          buffer = parts.pop() ?? "";
          for (const line of parts) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const payload = trimmed.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;
            try {
              const json = JSON.parse(payload) as Record<string, unknown>;
              const u = parseOpenAiUsage(json);
              if (
                u.totalTokens != null ||
                u.promptTokens != null ||
                u.completionTokens != null
              ) {
                lastUsage = u;
              }
              const err = json.error as { message?: string } | undefined;
              if (typeof err?.message === "string") failMessage = err.message;
            } catch {
              /* ignore partial JSON */
            }
          }
        }
        await finish({
          status: failMessage ? "FAILED" : "SUCCEEDED",
          failCode: failMessage ? "STREAM_VENDOR_ERROR" : undefined,
          failMessage,
        });
        controller.close();
      } catch (e) {
        const code =
          e && typeof e === "object" && "code" in e
            ? String((e as { code?: string }).code)
            : "STREAM_INTERRUPTED";
        const msg = e instanceof Error ? e.message : "流式连接中断";
        await finish({
          status: "FAILED",
          failCode: code || "STREAM_INTERRUPTED",
          failMessage: msg,
        });
        try {
          controller.error(e instanceof Error ? e : new Error(msg));
        } catch {
          /* already closed */
        }
      } finally {
        try {
          reader.releaseLock();
        } catch {
          /* ignore */
        }
      }
    },
    async cancel() {
      try {
        await reader?.cancel();
      } catch {
        /* ignore */
      }
      await finish({
        status: "FAILED",
        failCode: "STREAM_ABORTED",
        failMessage: "客户端断开，流式连接已取消",
      });
    },
  });
}
