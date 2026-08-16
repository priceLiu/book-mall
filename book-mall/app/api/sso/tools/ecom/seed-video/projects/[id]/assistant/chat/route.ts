import { NextResponse } from "next/server";

import type { CanvasChatContentPart } from "@/lib/canvas/providers/types";
import {
  assertStoryLlmVisionModel,
  isStoryLlmVisionModel,
} from "@/lib/canvas/story-llm-vision-models";
import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { buildSeedVideoSystemPrompt } from "@/lib/ecom/ecom-seed-video-prompts";
import {
  collectSeedVideoPlanningTexts,
  parseSeedVideoTargetDurationFromText,
  resolveSeedVideoTargetDurationSec,
} from "@/lib/ecom/ecom-seed-video-duration";
import { resolveSeedVideoSkillKey } from "@/lib/ecom/ecom-seed-video-skills";
import {
  getEcomSeedVideoProject,
  updateEcomSeedVideoProject,
} from "@/lib/ecom/ecom-seed-video-service";
import {
  resolveMentionedRefIds,
  resolveSeedVideoChatImageUrls,
} from "@/lib/ecom/ecom-seed-video-mention";
import {
  buildSeedVideoWorkflowContext,
  mergeSeedVideoWorkflowFromUserChoice,
  shouldAttachSeedVideoChatImages,
} from "@/lib/ecom/ecom-seed-video-workflow";
import {
  ECOM_SEED_VIDEO_DEFAULT_CHAT_MODEL,
  ECOM_SEED_VIDEO_TOOL_KEY,
  sanitizeSeedVideoChatMessages,
  type SeedVideoChatMessage,
} from "@/lib/ecom/ecom-seed-video-types";
import { getVisionMaxInputImages } from "@/lib/ecom/ecom-product-design-ref-rules";
import { ecomClientPage } from "@/lib/ecom/ecom-tool-keys";
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

  let modelKey =
    typeof body.modelKey === "string" && body.modelKey.trim()
      ? body.modelKey.trim()
      : project.settings.chatModelKey?.trim() || ECOM_SEED_VIDEO_DEFAULT_CHAT_MODEL;

  const lastUserText = turns[turns.length - 1]!.content;
  const planningPrompt =
    typeof project.meta?.planningPrompt === "string" ? project.meta.planningPrompt : undefined;
  const planningTexts = collectSeedVideoPlanningTexts({ turns, planningPrompt });
  const targetDurationSec = resolveSeedVideoTargetDurationSec({
    texts: planningTexts,
    planDurationSec: project.plan?.directVideo?.durationSec,
    settingsTargetDurationSec: project.settings.targetDurationSec,
  });
  const parsedFromUser = parseSeedVideoTargetDurationFromText(lastUserText);
  if (
    parsedFromUser != null &&
    parsedFromUser !== project.settings.targetDurationSec
  ) {
    try {
      await updateEcomSeedVideoProject(auth.userId, projectId, {
        settings: { ...project.settings, targetDurationSec: parsedFromUser },
      });
      project.settings.targetDurationSec = parsedFromUser;
    } catch {
      /* 不阻断助手 */
    }
  }

  const aspectRatio = project.settings.aspectRatio ?? "9:16";

  const systemPrompt = buildSeedVideoSystemPrompt({
    skillKey: resolveSeedVideoSkillKey(project.settings.skillKey),
    targetDurationSec,
    aspectRatio,
    materialCount: project.references.length,
    workflowContext: buildSeedVideoWorkflowContext({
      chatHistory: turns,
      meta: project.meta,
    }),
  });

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const priorUserCount = turns.slice(0, -1).filter((m) => m.role === "user").length;
    const attachImages = shouldAttachSeedVideoChatImages(lastUserText, priorUserCount);
    const max = getVisionMaxInputImages(modelKey);
    const refUrls = attachImages
      ? resolveSeedVideoChatImageUrls(project.references, lastUserText, max)
      : [];
    if (refUrls.length > 0 && !isStoryLlmVisionModel(modelKey)) {
      modelKey = ECOM_SEED_VIDEO_DEFAULT_CHAT_MODEL;
    }
    if (refUrls.length > 0) {
      assertStoryLlmVisionModel(modelKey, "种草视频策划");
    }
    const refIds = attachImages
      ? resolveMentionedRefIds(project.references, lastUserText)
      : [];
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
          const clientMessages = sanitizeSeedVideoChatMessages(body.messages);
          const history: SeedVideoChatMessage[] = [
            ...clientMessages.map((m, index) => ({
              id: m.id ?? `${m.role}-${Date.now()}-${index}`,
              role: m.role,
              content: m.content,
              createdAt: m.createdAt ?? now,
              refIds:
                index === clientMessages.length - 1 && m.role === "user" && refIds.length > 0
                  ? refIds
                  : m.refIds,
            })),
            {
              id: `assistant-${Date.now()}`,
              role: "assistant",
              content: fullText.trim(),
              createdAt: now,
            },
          ];

          try {
            const prevWorkflow =
              (project.meta?.workflow as Record<string, unknown> | undefined) ?? {};
            const workflow = mergeSeedVideoWorkflowFromUserChoice(
              prevWorkflow,
              lastUserText,
            );
            const prevMeta = (project.meta as Record<string, unknown> | undefined) ?? {};
            await updateEcomSeedVideoProject(auth.userId, projectId, {
              chatHistory: history,
              meta: {
                ...prevMeta,
                lastAssistantRaw: fullText.trim(),
                workflow: { ...prevWorkflow, ...workflow },
              },
            });
          } catch (persistErr) {
            console.error("[seed-video assistant/chat] persist failed", projectId, persistErr);
          }
          controller.close();
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : "助手流式输出失败";
          console.error("[seed-video assistant/chat]", projectId, e);
          if (fullText.trim()) {
            try {
              const now = new Date().toISOString();
              const clientMessages = sanitizeSeedVideoChatMessages(body.messages);
              const history: SeedVideoChatMessage[] = [
                ...clientMessages.map((m, index) => ({
                  id: m.id ?? `${m.role}-${Date.now()}-${index}`,
                  role: m.role,
                  content: m.content,
                  createdAt: m.createdAt ?? now,
                  refIds: m.refIds,
                })),
                {
                  id: `assistant-${Date.now()}`,
                  role: "assistant",
                  content: fullText.trim(),
                  createdAt: now,
                },
              ];
              const prevWorkflow =
                (project.meta?.workflow as Record<string, unknown> | undefined) ?? {};
              const workflow = mergeSeedVideoWorkflowFromUserChoice(
                prevWorkflow,
                lastUserText,
              );
              await updateEcomSeedVideoProject(auth.userId, projectId, {
                chatHistory: history,
                meta: { lastAssistantRaw: fullText, workflow },
              });
            } catch (persistErr) {
              console.error("[seed-video assistant/chat] partial persist failed", persistErr);
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
    const message = e instanceof Error ? e.message : "助手请求失败";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
