import { ecomGatewayLogHeaders, ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";

import {
  isStoryLlmVideoUnderstandingModel,
  isStoryLlmVisionModel,
} from "@/lib/canvas/story-llm-vision-models";
import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
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
import {
  extractMediaDecomposePatch,
  resolveMediaDecomposeParseError,
  toMediaDecomposeFence,
} from "@/lib/ecom/ecom-media-decompose-structured";
import {
  resolveMediaDecomposeChatModelKey,
  runMediaDecomposeGateway,
} from "@/lib/ecom/run-media-decompose-gateway";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  const { id: projectId } = await ctx.params;

  let body: { prompt?: unknown; modelKey?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return ecomJson({ error: "invalid_json" }, { status: 400 });
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) {
    return ecomJson({ error: "请填写拆解指令" }, { status: 400 });
  }

  const project = await getEcomMediaDecomposeProject(auth.userId, projectId);
  if (!project) return ecomJson({ error: "项目不存在" }, { status: 404 });
  if (!project.media?.ossUrl) {
    return ecomJson({ error: "请先上传或粘贴素材" }, { status: 400 });
  }

  let modelKey =
    typeof body.modelKey === "string" && body.modelKey.trim()
      ? body.modelKey.trim()
      : project.settings.chatModelKey?.trim() || ECOM_MEDIA_DECOMPOSE_DEFAULT_CHAT_MODEL;

  const media = project.media;

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    if (!isStoryLlmVisionModel(modelKey)) {
      modelKey = ECOM_MEDIA_DECOMPOSE_DEFAULT_CHAT_MODEL;
    }
    if (media.kind === "video" && !isStoryLlmVideoUnderstandingModel(modelKey)) {
      modelKey = ECOM_MEDIA_DECOMPOSE_DEFAULT_CHAT_MODEL;
    }
    modelKey = resolveMediaDecomposeChatModelKey(modelKey, media.kind);

    const clientPage = ecomClientPage(auth.userId, projectId, ECOM_MEDIA_DECOMPOSE_TOOL_KEY);

    await updateEcomMediaDecomposeProject(auth.userId, projectId, {
      settings: { ...project.settings, chatModelKey: modelKey, lastPrompt: prompt },
    });

    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        let streamedText = "";
        try {
          const result = await runMediaDecomposeGateway({
            userId: auth.userId,
            media: { kind: media.kind, ossUrl: media.ossUrl },
            modelKey,
            userPrompt: prompt,
            clientPage,
            handlers: {
              onAsrStatus: (message) => {
                controller.enqueue(encoder.encode(`${message}\n`));
              },
              onThinking: () => {
                controller.enqueue(encoder.encode("（模型思考中…）\n"));
              },
              onContent: (piece) => {
                streamedText += piece;
                controller.enqueue(encoder.encode(piece));
              },
            },
          });

          try {
            await saveMediaDecomposeResult(auth.userId, projectId, {
              rawText: result.rawText,
              structured: result.structured,
              parseError: result.parseError,
              completedAt: new Date().toISOString(),
            });
          } catch (persistErr) {
            console.error("[media-decompose decompose] persist failed", projectId, persistErr);
          }
          controller.close();
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : "拆解流式输出失败";
          console.error("[media-decompose decompose]", projectId, e);
          if (streamedText.trim()) {
            try {
              const extractedOnAbort = extractMediaDecomposePatch(streamedText);
              await saveMediaDecomposeResult(auth.userId, projectId, {
                rawText: extractedOnAbort
                  ? toMediaDecomposeFence(extractedOnAbort)
                  : streamedText.trim(),
                structured: extractedOnAbort ?? null,
                parseError: resolveMediaDecomposeParseError(streamedText),
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
        }
      },
    });

    return new Response(readable, {
      headers: {
        ...ecomGatewayLogHeaders(),
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "拆解请求失败";
    return ecomJson({ error: message }, { status: 502 });
  }
}
