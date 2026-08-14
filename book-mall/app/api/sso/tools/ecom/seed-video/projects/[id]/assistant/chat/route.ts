import { NextResponse } from "next/server";

import type { CanvasChatContentPart } from "@/lib/canvas/providers/types";
import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { buildSeedVideoSystemPrompt } from "@/lib/ecom/ecom-seed-video-prompts";
import {
  getEcomSeedVideoProject,
  updateEcomSeedVideoProject,
} from "@/lib/ecom/ecom-seed-video-service";
import {
  resolveMentionedRefIds,
  resolveSeedVideoChatImageUrls,
} from "@/lib/ecom/ecom-seed-video-mention";
import {
  sanitizeSeedVideoChatMessages,
  type SeedVideoChatMessage,
} from "@/lib/ecom/ecom-seed-video-types";
import { getVisionMaxInputImages } from "@/lib/ecom/ecom-product-design-ref-rules";
import { ecomClientPage } from "@/lib/ecom/ecom-tool-keys";
import { ECOM_SEED_VIDEO_TOOL_KEY } from "@/lib/ecom/ecom-seed-video-types";
import { ECOM_STORYBOARD_DEFAULT_CHAT_MODEL } from "@/lib/gateway/ecom-storyboard-chat-models";
import { ecomGwChatStream } from "@/lib/gateway/ecom-tool-gateway-client";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

function buildGwTurns(
  turns: Array<{ role: string; content: string }>,
  imageUrls: string[],
): Array<{ role: "user" | "assistant" | "system"; content: string | CanvasChatContentPart[] }> {
  return turns.map((m, index) => {
    const isLastUser =
      m.role === "user" && index === turns.length - 1 && imageUrls.length > 0;
    if (!isLastUser) {
      return { role: m.role as "user" | "assistant", content: m.content };
    }
    const parts: CanvasChatContentPart[] = [
      ...imageUrls.map(
        (url): CanvasChatContentPart => ({
          type: "image_url",
          image_url: { url },
        }),
      ),
      { type: "text", text: m.content },
    ];
    return { role: "user" as const, content: parts };
  });
}

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id: projectId } = await ctx.params;

  let body: { messages?: unknown; modelKey?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const turns = sanitizeSeedVideoChatMessages(body.messages).map((m) => ({
    role: m.role,
    content: m.content,
  }));
  if (!turns.length || turns[turns.length - 1]!.role !== "user") {
    return NextResponse.json({ error: "最后一条消息须为用户提问" }, { status: 400 });
  }

  const project = await getEcomSeedVideoProject(auth.userId, projectId);
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });

  const modelKey =
    typeof body.modelKey === "string" && body.modelKey.trim()
      ? body.modelKey.trim()
      : project.settings.chatModelKey?.trim() || ECOM_STORYBOARD_DEFAULT_CHAT_MODEL;

  const targetDurationSec = project.settings.targetDurationSec ?? 30;
  const aspectRatio = project.settings.aspectRatio ?? "9:16";
  const lastUserText = turns[turns.length - 1]!.content;

  const systemPrompt = buildSeedVideoSystemPrompt({
    targetDurationSec,
    aspectRatio,
    materialCount: project.references.length,
  });

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const max = getVisionMaxInputImages(modelKey);
    const refUrls = resolveSeedVideoChatImageUrls(project.references, lastUserText, max);
    const refIds = resolveMentionedRefIds(project.references, lastUserText);
    const gwTurns = buildGwTurns(turns, refUrls);
    const gw = await ecomGwChatStream(auth.userId, {
      modelKey,
      messages: [{ role: "system", content: systemPrompt }, ...gwTurns],
      clientPage: ecomClientPage(auth.userId, projectId, ECOM_SEED_VIDEO_TOOL_KEY),
    });

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    let fullText = "";

    const readable = new ReadableStream({
      async start(controller) {
        const reader = gw.body.getReader();
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
                if (piece) {
                  fullText += piece;
                  controller.enqueue(encoder.encode(piece));
                }
              } catch {
                /* ignore */
              }
            }
          }

          const now = new Date().toISOString();
          const history: SeedVideoChatMessage[] = [
            ...project.chatHistory,
            {
              id: `user-${Date.now()}`,
              role: "user",
              content: lastUserText,
              createdAt: now,
              refIds: refIds.length > 0 ? refIds : undefined,
            },
            {
              id: `assistant-${Date.now()}`,
              role: "assistant",
              content: fullText.trim(),
              createdAt: now,
            },
          ];

          await updateEcomSeedVideoProject(auth.userId, projectId, {
            chatHistory: history,
            meta: { lastAssistantRaw: fullText },
          });
          controller.close();
        } catch (e) {
          controller.error(e);
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
  } catch (e) {
    const message = e instanceof Error ? e.message : "助手请求失败";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
