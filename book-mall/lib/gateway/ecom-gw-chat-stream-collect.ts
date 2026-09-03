/**
 * 电商工具箱 · 消费 Gateway SSE chat/completions 流并汇总全文。
 * 拆图拆视频、专业拉片等长视频理解场景共用（与 media-decompose decompose/route 一致）。
 */
import type { CanvasChatMessage } from "@/lib/canvas/providers/types";
import { ecomGwChatStream } from "@/lib/gateway/ecom-tool-gateway-client";
import { readEcomGwChatSseStream } from "@/lib/gateway/ecom-gw-chat-sse-read";

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
    onThinkingProgress?: () => void;
  },
): Promise<string> {
  throwIfAborted(opts.signal);

  const gw = await ecomGwChatStream(bookUserId, {
    modelKey: opts.modelKey,
    messages: opts.messages,
    clientPage: opts.clientPage,
    params: opts.params,
  });

  return readEcomGwChatSseStream(gw.body, {
    signal: opts.signal,
    handlers: {
      onContent: (_piece, accumulated) => {
        opts.onChunk?.(accumulated);
      },
      onThinkingProgress: opts.onThinkingProgress,
    },
  });
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

  return new ReadableStream({
    async start(controller) {
      let thinkingSent = false;
      let fullText = "";
      try {
        const text = await readEcomGwChatSseStream(gwBody, {
          signal: opts?.signal,
          handlers: {
            onThinkingProgress: () => {
              if (thinkingSent) return;
              thinkingSent = true;
              controller.enqueue(encoder.encode("（模型思考中…）\n"));
            },
            onContent: (piece) => {
              fullText += piece;
              controller.enqueue(encoder.encode(piece));
            },
          },
        });
        await opts?.onFullText?.(text);
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
        opts?.onFinally?.();
      }
    },
  });
}
