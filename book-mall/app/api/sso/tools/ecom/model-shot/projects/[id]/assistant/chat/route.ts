import { NextResponse } from "next/server";

import type { CanvasChatContentPart } from "@/lib/canvas/providers/types";
import {
  assertStoryLlmVisionModel,
  isStoryLlmVisionModel,
} from "@/lib/canvas/story-llm-vision-models";
import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { buildModelShotSystemPrompt } from "@/lib/ecom/ecom-model-shot-prompts";
import { parseModelShotAssistantOutput } from "@/lib/ecom/ecom-model-shot-parse";
import {
  getEcomModelShotProject,
  updateEcomModelShotProject,
} from "@/lib/ecom/ecom-model-shot-service";
import {
  ECOM_MODEL_SHOT_TOOL_KEY,
  sanitizeModelShotChatMessages,
  type ModelShotChatMessage,
} from "@/lib/ecom/ecom-model-shot-types";
import { getVisionMaxInputImages } from "@/lib/ecom/ecom-product-design-ref-rules";
import { ecomClientPage } from "@/lib/ecom/ecom-tool-keys";
import { ECOM_DEFAULT_VISION_MODEL } from "@/lib/gateway/ecom-storyboard-chat-models";
import { ecomGwChatStream } from "@/lib/gateway/ecom-tool-gateway-client";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

function buildGwTurns(
  turns: Array<{ role: string; content: string }>,
  imageUrls: string[],
) {
  return turns.map((m, index) => {
    const isLastUser =
      m.role === "user" && index === turns.length - 1 && imageUrls.length > 0;
    if (!isLastUser) {
      return { role: m.role as "user" | "assistant", content: m.content };
    }
    const parts: CanvasChatContentPart[] = [
      ...imageUrls.map(
        (url): CanvasChatContentPart => ({ type: "image_url", image_url: { url } }),
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

  const incoming = sanitizeModelShotChatMessages(body.messages);
  const turns = incoming.map((m) => ({ role: m.role, content: m.content }));
  if (!turns.length || turns[turns.length - 1]!.role !== "user") {
    return NextResponse.json({ error: "最后一条消息须为用户提问" }, { status: 400 });
  }

  const project = await getEcomModelShotProject(auth.userId, projectId);
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });

  let modelKey =
    typeof body.modelKey === "string" && body.modelKey.trim()
      ? body.modelKey.trim()
      : project.settings.chatModelKey?.trim() || ECOM_DEFAULT_VISION_MODEL;

  const systemPrompt = buildModelShotSystemPrompt(project);

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const max = getVisionMaxInputImages(modelKey);
    const refUrls = project.references
      .filter((r) => r.ossUrl)
      .slice(0, max)
      .map((r) => r.ossUrl!);
    if (refUrls.length > 0 && !isStoryLlmVisionModel(modelKey)) {
      modelKey = ECOM_DEFAULT_VISION_MODEL;
    }
    if (refUrls.length > 0) {
      assertStoryLlmVisionModel(modelKey, "服装模特图助手");
    }

    const gw = await ecomGwChatStream(auth.userId, {
      modelKey,
      messages: [
        { role: "system", content: systemPrompt },
        ...buildGwTurns(turns, refUrls),
      ],
      clientPage: ecomClientPage(auth.userId, projectId, ECOM_MODEL_SHOT_TOOL_KEY),
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

          const parsed = parseModelShotAssistantOutput(project, fullText);
          const history: ModelShotChatMessage[] = [
            ...project.chatHistory.filter((m) => m.id !== incoming[incoming.length - 1]?.id),
            ...incoming.slice(-1),
            {
              id: `assistant-${Date.now()}`,
              role: "assistant",
              content: fullText.trim(),
              createdAt: new Date().toISOString(),
            },
          ];

          await updateEcomModelShotProject(auth.userId, projectId, {
            chatHistory: history,
            meta: {
              ...(project.meta ?? {}),
              ...(parsed.patch.meta ?? {}),
              lastAssistantRaw: fullText,
            },
            ...(parsed.patch.brief ? { brief: parsed.patch.brief } : {}),
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
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "对话失败" },
      { status: 500 },
    );
  }
}
