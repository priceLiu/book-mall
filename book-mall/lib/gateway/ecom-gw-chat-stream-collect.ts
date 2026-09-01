/**
 * 电商工具箱 · 消费 Gateway SSE chat/completions 流并汇总全文。
 * 拆图拆视频、专业拉片等长视频理解场景共用（与 media-decompose decompose/route 一致）。
 */
import type { CanvasChatMessage } from "@/lib/canvas/providers/types";
import { ecomGwChatStream } from "@/lib/gateway/ecom-tool-gateway-client";

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    const err = new Error("请求已取消");
    err.name = "AbortError";
    throw err;
  }
}

export async function collectEcomGwChatStreamText(
  bookUserId: string,
  opts: {
    modelKey: string;
    messages: CanvasChatMessage[];
    clientPage?: string;
    params?: Record<string, unknown>;
    signal?: AbortSignal;
    onChunk?: (accumulated: string) => void;
  },
): Promise<string> {
  throwIfAborted(opts.signal);

  const gw = await ecomGwChatStream(bookUserId, {
    modelKey: opts.modelKey,
    messages: opts.messages,
    clientPage: opts.clientPage,
    params: opts.params,
  });

  const decoder = new TextDecoder();
  const reader = gw.body.getReader();
  let sseBuffer = "";
  let fullText = "";

  try {
    while (true) {
      throwIfAborted(opts.signal);
      const { done, value } = await reader.read();
      if (done) break;
      sseBuffer += decoder.decode(value, { stream: true });
      const lines = sseBuffer.split("\n");
      sseBuffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const chunk = JSON.parse(payload) as {
            choices?: { delta?: { content?: string | null } }[];
          };
          const piece = chunk.choices?.[0]?.delta?.content ?? "";
          if (piece) {
            fullText += piece;
            opts.onChunk?.(fullText);
          }
        } catch {
          /* ignore malformed SSE chunk */
        }
      }
    }
    return fullText.trim();
  } finally {
    reader.releaseLock();
  }
}

/** 将 Gateway SSE 字节流转发为 text/plain，同时可选收集全文 */
export function pipeGatewaySseChatToTextPlain(
  gwBody: ReadableStream<Uint8Array>,
  opts?: {
    signal?: AbortSignal;
    onFullText?: (text: string) => void | Promise<void>;
    onFinally?: () => void;
  },
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let sseBuffer = "";
  let fullText = "";

  return new ReadableStream({
    async start(controller) {
      const reader = gwBody.getReader();
      try {
        while (true) {
          if (opts?.signal?.aborted) {
            throw new Error("请求已取消");
          }
          const { done, value } = await reader.read();
          if (done) break;
          sseBuffer += decoder.decode(value, { stream: true });
          const lines = sseBuffer.split("\n");
          sseBuffer = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const payload = trimmed.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;
            try {
              const chunk = JSON.parse(payload) as {
                choices?: { delta?: { content?: string | null } }[];
              };
              const piece = chunk.choices?.[0]?.delta?.content ?? "";
              if (piece) {
                fullText += piece;
                controller.enqueue(encoder.encode(piece));
              }
            } catch {
              /* ignore */
            }
          }
        }
        await opts?.onFullText?.(fullText.trim());
        controller.close();
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : "流式输出失败";
        if (fullText.trim()) {
          try {
            await opts?.onFullText?.(fullText.trim());
          } catch {
            /* ignore persist error on partial */
          }
          controller.enqueue(
            encoder.encode(`\n\n（输出中断：${errMsg}，已保存已生成部分）`),
          );
          controller.close();
          return;
        }
        controller.error(e instanceof Error ? e : new Error(errMsg));
      } finally {
        reader.releaseLock();
        opts?.onFinally?.();
      }
    },
  });
}
