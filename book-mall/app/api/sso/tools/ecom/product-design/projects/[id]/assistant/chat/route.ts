import { NextResponse } from "next/server";

import type { CanvasChatContentPart } from "@/lib/canvas/providers/types";
import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { getEcomPlatformSpec } from "@/lib/ecom/ecom-platform-spec";
import { buildProductDesignSystemPrompt } from "@/lib/ecom/ecom-product-design-prompts";
import {
  getProductDesignProject,
  updateProductDesignProject,
  type ProductDesignPatch,
} from "@/lib/ecom/ecom-product-design-service";
import {
  ECOM_DETAIL_COPY_ACTION,
  ECOM_DETAIL_PAGE_TOOL_KEY,
  extractProductDesignJson,
  filterProductDesignReferencesByRole,
  resolveProjectTrack,
  sanitizeProductDesignChatMessages,
  type ProductDesignChatMessage,
  type ProductDesignReference,
} from "@/lib/ecom/ecom-product-design-types";
import { prepareProductDesignPatch } from "@/lib/ecom/ecom-product-design-marketing-parse";
import { toAssistantChatContent } from "@/lib/ecom/ecom-product-design-display";
import { getVisionMaxInputImages } from "@/lib/ecom/ecom-product-design-ref-rules";
import { ecomClientPage } from "@/lib/ecom/ecom-tool-keys";
import { ECOM_STORYBOARD_DEFAULT_CHAT_MODEL } from "@/lib/gateway/ecom-storyboard-chat-models";
import { ecomGwChatStream } from "@/lib/gateway/ecom-tool-gateway-client";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

/** 去掉机器可读围栏，气泡只展示面向用户的 Markdown */
function chatRefImageUrls(
  references: ProductDesignReference[],
  modelKey: string,
  track: "main" | "detail",
): string[] {
  const product = filterProductDesignReferencesByRole(references, ["product"]);
  const style = filterProductDesignReferencesByRole(references, [
    track === "detail" ? "detail-style" : "main-style",
  ]);
  const max = getVisionMaxInputImages(modelKey);
  return [...product, ...style].slice(0, max).map((r) => r.ossUrl);
}

/** Prompt 驱动分支（含存量 reference-decompose / reference）不采集 Brief */
function isBriefSkippedForPrompt(
  meta: Record<string, unknown> | null | undefined,
  track: "main" | "detail",
): boolean {
  if (meta?.briefSkipped) return true;
  if (track === "detail") {
    return meta?.detailWorkflowPath !== "interactive";
  }
  const path = meta?.mainWorkflowPath;
  return typeof path === "string" && path.length > 0 && path !== "interactive";
}

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
  if (!auth.ok) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const { id: projectId } = await ctx.params;

  let body: { messages?: unknown; modelKey?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const turns = sanitizeProductDesignChatMessages(body.messages).map((m) => ({
    role: m.role,
    content: m.content,
  }));
  if (!turns.length || turns[turns.length - 1]!.role !== "user") {
    return NextResponse.json({ error: "最后一条消息须为用户提问" }, { status: 400 });
  }

  const project = await getProductDesignProject(auth.userId, projectId);
  if (!project) {
    return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  }

  const modelKey =
    typeof body.modelKey === "string" && body.modelKey.trim()
      ? body.modelKey.trim()
      : project.settings.chatModelKey?.trim() || ECOM_STORYBOARD_DEFAULT_CHAT_MODEL;

  const activeTrack = resolveProjectTrack(project.module);
  const systemPrompt = buildProductDesignSystemPrompt({
    spec: getEcomPlatformSpec(project.platform),
    mainImageCount: project.resolved.mainImageCount,
    detailPageCount: project.resolved.detailPageCount,
    mainImageRatio: project.resolved.mainImageRatio,
    detailPageRatio: project.resolved.detailPageRatio,
    brief: project.brief,
    hasProductRef: project.references.some((r) => r.role === "product"),
    briefSkipped: isBriefSkippedForPrompt(project.meta, activeTrack),
    mainWorkflowPath: (project.meta?.mainWorkflowPath as string | null) ?? null,
    design: project.design,
    activeTrack,
  });

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const refUrls = chatRefImageUrls(project.references, modelKey, activeTrack);
    const gwTurns = buildGwTurns(turns, refUrls);
    const gw = await ecomGwChatStream(auth.userId, {
      modelKey,
      messages: [{ role: "system", content: systemPrompt }, ...gwTurns],
      clientPage: ecomClientPage(
        auth.userId,
        projectId,
        `${ECOM_DETAIL_PAGE_TOOL_KEY}__${ECOM_DETAIL_COPY_ACTION}`,
      ),
    });

    const upstream = gw.body;
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    let fullText = "";

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
                if (piece) {
                  fullText += piece;
                  controller.enqueue(encoder.encode(piece));
                }
              } catch {
                /* 忽略非 JSON 心跳 */
              }
            }
          }

          const now = new Date().toISOString();
          const history: ProductDesignChatMessage[] = [
            ...project.chatHistory,
            {
              id: `user-${Date.now()}`,
              role: "user",
              content: turns[turns.length - 1]!.content,
              createdAt: now,
            },
            {
              id: `assistant-${Date.now()}`,
              role: "assistant",
              content: toAssistantChatContent(fullText),
              createdAt: now,
            },
          ];

          const patch: ProductDesignPatch = { chatHistory: history };
          const jsonPatch = extractProductDesignJson(fullText);
          const designPatch = prepareProductDesignPatch(project.design, jsonPatch ?? {}, {
            markdownText: fullText,
          });
          if (Object.keys(designPatch).length > 0) {
            patch.designPatch = designPatch;
            patch.status = designPatch.detailPages?.length
              ? "detail_ready"
              : designPatch.mainImages?.length
                ? "main_copy_ready"
                : "analyzing";
          }
          patch.meta = { lastAssistantRaw: fullText };

          await updateProductDesignProject(auth.userId, projectId, patch);
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
