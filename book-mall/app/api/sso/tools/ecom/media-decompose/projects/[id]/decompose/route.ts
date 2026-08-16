import { NextResponse } from "next/server";

import type { CanvasChatContentPart } from "@/lib/canvas/providers/types";
import {
  assertStoryLlmVideoUnderstandingModel,
  assertStoryLlmVisionModel,
  isStoryLlmVisionModel,
} from "@/lib/canvas/story-llm-vision-models";
import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { buildMediaDecomposeSystemPrompt } from "@/lib/ecom/ecom-media-decompose-prompts";
import {
  extractMediaDecomposePatch,
  resolveMediaDecomposeParseError,
} from "@/lib/ecom/ecom-media-decompose-structured";
import {
  getEcomMediaDecomposeProject,
  saveMediaDecomposeResult,
  updateEcomMediaDecomposeProject,
} from "@/lib/ecom/ecom-media-decompose-service";
import {
  ECOM_MEDIA_DECOMPOSE_DEFAULT_CHAT_MODEL,
  ECOM_MEDIA_DECOMPOSE_TOOL_KEY,
} from "@/lib/ecom/ecom-media-decompose-types";
import { ecomClientPage } from "@/lib/ecom/ecom-tool-keys";
import { ecomGwChatStream } from "@/lib/gateway/ecom-tool-gateway-client";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

function buildMediaGwUserContent(
  prompt: string,
  media: { kind: "image" | "video"; ossUrl: string },
): string | CanvasChatContentPart[] {
  const parts: CanvasChatContentPart[] = [];
  if (media.kind === "video") {
    parts.push({ type: "video_url", video_url: { url: media.ossUrl } });
  } else {
    parts.push({ type: "image_url", image_url: { url: media.ossUrl } });
  }
  parts.push({ type: "text", text: prompt });
  return parts;
}

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id: projectId } = await ctx.params;

  let body: { prompt?: unknown; modelKey?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) {
    return NextResponse.json({ error: "请填写拆解指令" }, { status: 400 });
  }

  const project = await getEcomMediaDecomposeProject(auth.userId, projectId);
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  if (!project.media?.ossUrl) {
    return NextResponse.json({ error: "请先上传或粘贴素材" }, { status: 400 });
  }

  let modelKey =
    typeof body.modelKey === "string" && body.modelKey.trim()
      ? body.modelKey.trim()
      : project.settings.chatModelKey?.trim() || ECOM_MEDIA_DECOMPOSE_DEFAULT_CHAT_MODEL;

  const media = project.media;
  const systemPrompt = buildMediaDecomposeSystemPrompt({ mediaKind: media.kind });

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    if (!isStoryLlmVisionModel(modelKey)) {
      modelKey = ECOM_MEDIA_DECOMPOSE_DEFAULT_CHAT_MODEL;
    }
    if (media.kind === "video") {
      assertStoryLlmVideoUnderstandingModel(modelKey, "拆图拆视频");
    } else {
      assertStoryLlmVisionModel(modelKey, "拆图拆视频");
    }

    await updateEcomMediaDecomposeProject(auth.userId, projectId, {
      settings: { ...project.settings, chatModelKey: modelKey, lastPrompt: prompt },
    });

    const gw = await ecomGwChatStream(auth.userId, {
      modelKey,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: buildMediaGwUserContent(prompt, media),
        },
      ],
      clientPage: ecomClientPage(auth.userId, projectId, ECOM_MEDIA_DECOMPOSE_TOOL_KEY),
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

          const structured = extractMediaDecomposePatch(fullText);
          const parseError = structured ? null : resolveMediaDecomposeParseError(fullText);
          try {
            await saveMediaDecomposeResult(auth.userId, projectId, {
              rawText: fullText.trim(),
              structured: structured ?? null,
              parseError,
              completedAt: new Date().toISOString(),
            });
          } catch (persistErr) {
            console.error("[media-decompose decompose] persist failed", projectId, persistErr);
          }
          controller.close();
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : "拆解流式输出失败";
          console.error("[media-decompose decompose]", projectId, e);
          if (fullText.trim()) {
            try {
              await saveMediaDecomposeResult(auth.userId, projectId, {
                rawText: fullText.trim(),
                structured: extractMediaDecomposePatch(fullText) ?? null,
                parseError: resolveMediaDecomposeParseError(fullText),
                completedAt: new Date().toISOString(),
              });
            } catch {
              /* ignore */
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
    const message = e instanceof Error ? e.message : "拆解请求失败";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
