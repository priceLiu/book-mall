import {
  chatStreamIdleMs,
  chatStreamWallMs,
} from "@/lib/gateway/gateway-health-policy";
import { parseOpenAiChatSsePayload } from "@/lib/gateway/ecom-gw-chat-sse-parse";

function readWithIdle(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  idleMs: number,
  signal?: AbortSignal,
): Promise<ReadableStreamReadResult<Uint8Array>> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(Object.assign(new Error("请求已取消"), { name: "AbortError" }));
      return;
    }
    const onAbort = () => {
      reject(Object.assign(new Error("请求已取消"), { name: "AbortError" }));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    const t = setTimeout(() => {
      reject(
        Object.assign(new Error("流式输出长时间无数据"), {
          code: "STREAM_IDLE_TIMEOUT",
        }),
      );
    }, idleMs);
    reader.read().then(
      (r) => {
        clearTimeout(t);
        signal?.removeEventListener("abort", onAbort);
        resolve(r);
      },
      (e) => {
        clearTimeout(t);
        signal?.removeEventListener("abort", onAbort);
        reject(e);
      },
    );
  });
}

export type EcomGwChatSseReadHandlers = {
  onContent?: (piece: string, accumulated: string) => void;
  /** GLM 等思考模式：仅用于 UI 心跳，不计入 JSON 正文 */
  onThinkingProgress?: () => void;
};

/** 消费 Gateway SSE chat 流；带空闲/墙钟超时，识别 reasoning_content */
export async function readEcomGwChatSseStream(
  body: ReadableStream<Uint8Array>,
  opts?: {
    signal?: AbortSignal;
    startedAtMs?: number;
    handlers?: EcomGwChatSseReadHandlers;
  },
): Promise<string> {
  const decoder = new TextDecoder();
  const reader = body.getReader();
  const idleMs = chatStreamIdleMs();
  const wallMs = chatStreamWallMs();
  const startedAtMs = opts?.startedAtMs ?? Date.now();
  let sseBuffer = "";
  let fullText = "";
  let thinkingHeartbeatSent = false;

  try {
    while (true) {
      if (opts?.signal?.aborted) {
        throw Object.assign(new Error("请求已取消"), { name: "AbortError" });
      }
      if (Date.now() - startedAtMs > wallMs) {
        throw Object.assign(new Error("流式输出超过墙钟上限"), {
          code: "STREAM_WALL_TIMEOUT",
        });
      }
      const { done, value } = await readWithIdle(reader, idleMs, opts?.signal);
      if (done) break;
      sseBuffer += decoder.decode(value, { stream: true });
      const lines = sseBuffer.split("\n");
      sseBuffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        const { content, reasoningContent } = parseOpenAiChatSsePayload(payload);
        if (reasoningContent && !thinkingHeartbeatSent) {
          thinkingHeartbeatSent = true;
          opts?.handlers?.onThinkingProgress?.();
        }
        if (content) {
          fullText += content;
          opts?.handlers?.onContent?.(content, fullText);
        }
      }
    }
    return fullText.trim();
  } finally {
    reader.releaseLock();
  }
}
