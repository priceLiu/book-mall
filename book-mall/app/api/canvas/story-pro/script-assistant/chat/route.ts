import { type NextRequest, NextResponse } from "next/server";

import { CanvasProjectError } from "@/lib/canvas/canvas-project-service";
import { canvasGwChatStream } from "@/lib/canvas/canvas-gateway-client";
import {
  canvasErrorToResponse,
  jsonHeaders,
  readJsonBody,
  requireSessionUser,
} from "@/lib/canvas/api-helpers";
import { sanitizeClientChatTurns } from "@/lib/canvas/story-pro-script-assistant-service";
import {
  buildScriptAssistantSystemPrompt,
  parseScriptAssistantOutputMode,
} from "@/lib/canvas/story-pro-script-assistant-prompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;

  let body: { messages?: unknown; outputMode?: unknown };
  try {
    const parsed = await readJsonBody(request);
    if (!parsed.ok) return parsed.response;
    body = parsed.body as { messages?: unknown; outputMode?: unknown };
  } catch {
    return NextResponse.json(
      { error: "invalid_json" },
      { status: 400, headers: jsonHeaders(request) },
    );
  }

  let turns: { role: "user" | "assistant"; content: string }[];
  try {
    turns = sanitizeClientChatTurns(body.messages);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "invalid_messages";
    const status = msg === "message_too_long" ? 413 : 400;
    return NextResponse.json({ error: msg }, { status, headers: jsonHeaders(request) });
  }

  if (!turns.length) {
    return NextResponse.json(
      { error: "至少需要一条用户消息" },
      { status: 400, headers: jsonHeaders(request) },
    );
  }
  if (turns[turns.length - 1]!.role !== "user") {
    return NextResponse.json(
      { error: "最后一条消息须为用户提问" },
      { status: 400, headers: jsonHeaders(request) },
    );
  }

  const outputMode = parseScriptAssistantOutputMode(body.outputMode);
  const systemPrompt = buildScriptAssistantSystemPrompt(outputMode);

  try {
    const gw = await canvasGwChatStream(guard.user.id, {
      modelKey: "deepseek-chat",
      messages: [
        { role: "system", content: systemPrompt },
        ...turns,
      ],
      clientPage: "canvas/script-assistant",
    });

    const upstream = gw.body;
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const readable = new ReadableStream({
      async start(controller) {
        const reader = upstream.getReader();
        let sseBuffer = "";
        try {
          while (true) {
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
                if (piece) controller.enqueue(encoder.encode(piece));
              } catch {
                /* ignore */
              }
            }
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        } finally {
          reader.releaseLock();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    if (err instanceof CanvasProjectError) {
      const status =
        err.code === "GATEWAY_KEY_REQUIRED"
          ? 403
          : err.httpStatus >= 400
            ? err.httpStatus
            : 502;
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status, headers: jsonHeaders(request) },
      );
    }
    return canvasErrorToResponse(request, err);
  }
}
