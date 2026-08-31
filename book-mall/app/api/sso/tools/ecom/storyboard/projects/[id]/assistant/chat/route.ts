import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import {
  buildProAssistantSystemPrompt,
  buildProDeliverableContextBlock,
  resolveProPromptPhase,
} from "@/lib/ecom/ecom-pro-assistant-prompts";
import {
  extractProDeliverable,
  inferProPhaseFromDeliverable,
  isProDeliverable,
  mergeProDeliverablePatch,
  pickProOpsMergePatch,
  pickProPhaseMergePatch,
  stripProDeliverableFence,
  type ProDeliverable,
} from "@/lib/ecom/ecom-pro-deliverable";
import { renderProDeliverableMarkdown } from "@/lib/ecom/ecom-pro-deliverable-render";
import { resolveWorkflowVertical } from "@/lib/ecom/pro-vertical/registry";
import {
  buildFashionAssistantSystemPrompt,
  buildFashionDeliverableContextBlock,
  resolveFashionPromptPhase,
} from "@/lib/ecom/ecom-fashion-assistant-prompts";
import {
  extractFashionDeliverable,
  inferFashionPhaseFromDeliverable,
  isFashionDeliverable,
  isFashionWorkflow,
  mergeFashionDeliverablePatch,
  pickFashionOpsMergePatch,
  pickFashionPhaseMergePatch,
  stripFashionDeliverableFence,
  type FashionDeliverable,
  type FashionLlmPhase,
} from "@/lib/ecom/ecom-fashion-deliverable";
import { renderFashionDeliverableMarkdown } from "@/lib/ecom/ecom-fashion-deliverable-render";
import {
  isLegacyGenericStoryboardMeta,
  stripDeliverableFence,
} from "@/lib/ecom/ecom-storyboard-deliverable";
import { isProVerticalWorkflow } from "@/lib/ecom/pro-vertical/registry";
import {
  getEcomStoryboardProject,
  updateEcomStoryboardProject,
} from "@/lib/ecom/ecom-storyboard-service";
import { ECOM_STORYBOARD_DEFAULT_CHAT_MODEL } from "@/lib/gateway/ecom-storyboard-chat-models";
import {
  ECOM_STORYBOARD_TOOL_KEY,
  sanitizeClientChatTurns,
  type StoryboardChatMessage,
} from "@/lib/ecom/ecom-storyboard-types";
import { ecomGwChatStream } from "@/lib/gateway/ecom-tool-gateway-client";
import { ensureGatewayChatLogSucceededAfterStream } from "@/lib/gateway/gateway-log-reconcile";
import { ecomClientPage } from "@/lib/ecom/ecom-tool-keys";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const { id: projectId } = await ctx.params;

  let body: {
    messages?: unknown;
    modelKey?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  let turns: { role: "user" | "assistant"; content: string }[];
  try {
    turns = sanitizeClientChatTurns(body.messages);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "invalid_messages";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  if (!turns.length || turns[turns.length - 1]!.role !== "user") {
    return NextResponse.json({ error: "最后一条消息须为用户提问" }, { status: 400 });
  }

  const project = await getEcomStoryboardProject(auth.userId, projectId);
  if (!project) {
    return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  }

  const modelKey =
    typeof body.modelKey === "string" && body.modelKey.trim()
      ? body.modelKey.trim()
      : ECOM_STORYBOARD_DEFAULT_CHAT_MODEL;
  const existingMeta =
    (project.meta as Record<string, unknown> | null) ?? {};
  const workflowVertical = resolveWorkflowVertical(
    existingMeta.workflow as Record<string, unknown> | undefined,
  );
  const isFashion = isFashionWorkflow(existingMeta);
  const isProVertical =
    workflowVertical != null && workflowVertical !== "fashion_apparel";
  const proVerticalId = isProVertical ? workflowVertical : null;
  const isLegacyGeneric =
    !isFashion && !isProVertical && isLegacyGenericStoryboardMeta(existingMeta);
  if (isLegacyGeneric) {
    return NextResponse.json(
      { error: "旧版通用故事版已停用，请新建电商专业版项目继续" },
      { status: 410 },
    );
  }

  const lastUserTurn = turns[turns.length - 1]!.content.trim();
  const fashionPromptPhase = isFashion ? resolveFashionPromptPhase(lastUserTurn) : "general";
  const proPromptPhase = isProVertical ? resolveProPromptPhase(lastUserTurn) : "general";
  const prevFashionDeliverable =
    isFashion && isFashionDeliverable(existingMeta.deliverable)
      ? existingMeta.deliverable
      : null;
  const prevProDeliverable =
    isProVertical && isProDeliverable(existingMeta.deliverable)
      ? existingMeta.deliverable
      : null;
  let systemPrompt = isFashion
    ? buildFashionAssistantSystemPrompt(fashionPromptPhase)
    : isProVertical && proVerticalId
      ? buildProAssistantSystemPrompt(proVerticalId, proPromptPhase)
      : buildFashionAssistantSystemPrompt("general");
  if (
    !isFashion &&
    !isProVertical &&
    !isProVerticalWorkflow(existingMeta) &&
    (lastUserTurn.includes("fashion-step:") || lastUserTurn.includes("pro-step:"))
  ) {
    return NextResponse.json({ error: "请先在助手区选择品类大类" }, { status: 400 });
  }
  if (prevFashionDeliverable && fashionPromptPhase !== "sellpoints" && fashionPromptPhase !== "general") {
    systemPrompt += buildFashionDeliverableContextBlock(
      prevFashionDeliverable,
      fashionPromptPhase,
    );
  }
  if (prevProDeliverable && proPromptPhase !== "sellpoints" && proPromptPhase !== "general") {
    systemPrompt += buildProDeliverableContextBlock(
      prevProDeliverable as Record<string, unknown>,
      proPromptPhase,
    );
  }

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const gw = await ecomGwChatStream(auth.userId, {
      modelKey,
      messages: [{ role: "system", content: systemPrompt }, ...turns],
      clientPage: ecomClientPage(auth.userId, projectId, ECOM_STORYBOARD_TOOL_KEY),
    });

    const gatewayLogId = gw.logId;
    const upstream = gw.body;
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    let fullText = "";

    const readable = new ReadableStream({
      async start(controller) {
        const reader = upstream.getReader();
        let sseBuffer = "";
        let streamInterrupted = false;
        let streamErrorMessage = "";
        try {
          while (true) {
            let done = false;
            let value: Uint8Array | undefined;
            try {
              ({ done, value } = await reader.read());
            } catch (readError) {
              streamInterrupted = true;
              streamErrorMessage =
                readError instanceof Error ? readError.message : "助手流式响应异常";
              break;
            }
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

          if (streamInterrupted && fullText.trim().length > 0) {
            controller.enqueue(
              encoder.encode(
                `\n\n【流中断：${streamErrorMessage}；已保留部分生成内容】`,
              ),
            );
          }

          const history: StoryboardChatMessage[] = [
            ...project.chatHistory,
            {
              id: `user-${Date.now()}`,
              role: "user",
              content: turns[turns.length - 1]!.content,
              createdAt: new Date().toISOString(),
            },
            {
              id: `assistant-${Date.now()}`,
              role: "assistant",
              content: fullText.trim(),
              createdAt: new Date().toISOString(),
            },
          ];

          const fashionPhaseHint: FashionLlmPhase | undefined =
            fashionPromptPhase === "sellpoints" || fashionPromptPhase === "sellpoints_polish"
              ? "sellpoints"
              : fashionPromptPhase === "voiceovers" ||
                  fashionPromptPhase === "storyboards" ||
                  fashionPromptPhase === "ops"
                ? fashionPromptPhase
                : undefined;
          const fashionDeliverablePatch = isFashion
            ? extractFashionDeliverable(fullText, fashionPhaseHint)
            : null;
          const proPhaseHint =
            proPromptPhase === "sellpoints" || proPromptPhase === "sellpoints_polish"
              ? "sellpoints"
              : proPromptPhase === "voiceovers" ||
                  proPromptPhase === "storyboards" ||
                  proPromptPhase === "ops"
                ? proPromptPhase
                : undefined;
          const proDeliverablePatch =
            isProVertical && proVerticalId
              ? extractProDeliverable(fullText, proVerticalId, proPhaseHint)
              : null;
          const briefText = isFashion
            ? stripFashionDeliverableFence(fullText)
            : isProVertical
              ? stripProDeliverableFence(fullText)
              : stripDeliverableFence(fullText);
          const existingWorkflow =
            (existingMeta.workflow as Record<string, unknown> | undefined) ?? {};
          const patch: Parameters<typeof updateEcomStoryboardProject>[2] = {
            chatHistory: history,
          };

          if (
            isFashion &&
            fashionDeliverablePatch &&
            Object.keys(fashionDeliverablePatch).length > 0
          ) {
            const prevFashion = existingMeta.deliverable as
              | Parameters<typeof mergeFashionDeliverablePatch>[0]
              | undefined;
            let llmFashionPatch: Partial<FashionDeliverable> = { ...fashionDeliverablePatch };
            if (fashionPhaseHint) {
              llmFashionPatch = pickFashionPhaseMergePatch(llmFashionPatch, fashionPhaseHint);
            }
            if (fashionPromptPhase === "voiceovers" && !prevFashion?.selectedVoiceoverId) {
              llmFashionPatch = { ...llmFashionPatch, selectedVoiceoverId: null };
            }
            llmFashionPatch = pickFashionOpsMergePatch(llmFashionPatch, {
              opsPhase: fashionPromptPhase === "ops",
              storyboardLocked: Boolean(prevFashion?.storyboardLocked),
            });
            const merged = mergeFashionDeliverablePatch(
              prevFashion,
              llmFashionPatch,
              typeof existingMeta.productName === "string"
                ? existingMeta.productName
                : prevFashion?.productName,
            );
            if (
              existingWorkflow.fashionSellpointsEdited === true &&
              prevFashion?.sellpoints?.length &&
              !prevFashion.sellpointsLocked
            ) {
              merged.sellpoints = prevFashion.sellpoints;
            }
            if (
              prevFashion?.selectedVersion &&
              prevFashion.storyboardVersions?.[prevFashion.selectedVersion]?.panels?.length
            ) {
              const key = prevFashion.selectedVersion;
              const savedPanels = prevFashion.storyboardVersions![key]!.panels!;
              merged.storyboardVersions = {
                ...(merged.storyboardVersions ?? {}),
                [key]: {
                  ...(merged.storyboardVersions?.[key] ??
                    prevFashion.storyboardVersions?.[key] ?? {
                      id: key,
                      title: `${key}版`,
                      panels: [],
                    }),
                  panels: savedPanels,
                },
              };
              merged.selectedVersion = key;
            } else if (
              existingWorkflow.fashionStoryboardPanelsEdited === true &&
              prevFashion?.selectedVersion
            ) {
              const key = prevFashion.selectedVersion;
              const savedPanels = prevFashion.storyboardVersions?.[key]?.panels;
              if (savedPanels?.length) {
                merged.storyboardVersions = {
                  ...(merged.storyboardVersions ?? {}),
                  [key]: {
                    ...(merged.storyboardVersions?.[key] ??
                      prevFashion.storyboardVersions?.[key] ?? {
                        id: key,
                        title: `${key}版`,
                        panels: [],
                      }),
                    panels: savedPanels,
                  },
                };
                merged.selectedVersion = key;
              }
            }
            if (prevFashion?.storyboardLocked && prevFashion.selectedVersion) {
              const key = prevFashion.selectedVersion;
              const lockedVersion = prevFashion.storyboardVersions?.[key];
              if (lockedVersion?.panels?.length) {
                merged.storyboardVersions = {
                  ...(merged.storyboardVersions ?? {}),
                  [key]: lockedVersion,
                };
                merged.selectedVersion = key;
                merged.storyboardLocked = true;
              }
            }
            if (prevFashion?.sellpointsLocked && prevFashion.sellpoints?.length) {
              merged.sellpoints = prevFashion.sellpoints;
              merged.sellpointsLocked = true;
            }
            if (
              fashionPromptPhase === "storyboards" &&
              prevFashion?.storyboardVersions
            ) {
              merged.storyboardVersions = {
                ...(prevFashion.storyboardVersions ?? {}),
                ...(merged.storyboardVersions ?? {}),
              };
            }
            const versionKey = merged.selectedVersion ?? undefined;
            const systemMarkdown = renderFashionDeliverableMarkdown(merged, {
              versionKey,
              includeAllVersions: !versionKey,
            });
            const fashionPhase = inferFashionPhaseFromDeliverable(
              merged,
              existingWorkflow.fashionPhase as string | undefined,
            );
            patch.meta = {
              ...existingMeta,
              deliverable: merged,
              deliverableMarkdown: systemMarkdown || briefText,
              workflow: {
                ...existingWorkflow,
                vertical: "fashion_apparel",
                fashionPhase,
                ...(merged.sellpointsLocked ? { fashionSellpointsEdited: false } : {}),
                ...(merged.storyboardLocked ? { fashionStoryboardPanelsEdited: false } : {}),
                ...(merged.opsPack ? { fashionStoryboardPanelsEdited: false } : {}),
              },
            };
            patch.status = "deliverable_ready";
          } else if (
            isProVertical &&
            proVerticalId &&
            proDeliverablePatch &&
            Object.keys(proDeliverablePatch).length > 0
          ) {
            const prevPro = existingMeta.deliverable as
              | Parameters<typeof mergeProDeliverablePatch>[0]
              | undefined;
            let llmProPatch: Partial<ProDeliverable> = { ...proDeliverablePatch };
            if (proPhaseHint) {
              llmProPatch = pickProPhaseMergePatch(llmProPatch, proPhaseHint);
            }
            if (
              proPhaseHint === "voiceovers" &&
              !prevPro?.selectedVoiceoverId
            ) {
              llmProPatch = { ...llmProPatch, selectedVoiceoverId: null };
            }
            llmProPatch = pickProOpsMergePatch(llmProPatch, {
              opsPhase: proPromptPhase === "ops",
              storyboardLocked: Boolean(prevPro?.storyboardLocked),
            });
            const merged = mergeProDeliverablePatch(
              prevPro,
              llmProPatch,
              proVerticalId,
              typeof existingMeta.productName === "string"
                ? existingMeta.productName
                : prevPro?.productName,
            );
            if (
              existingWorkflow.proSellpointsEdited === true &&
              prevPro?.sellpoints?.length &&
              !prevPro.sellpointsLocked
            ) {
              merged.sellpoints = prevPro.sellpoints;
            }
            if (prevPro?.storyboardLocked && prevPro.selectedVersion) {
              const key = prevPro.selectedVersion;
              const lockedVersion = prevPro.storyboardVersions?.[key];
              if (lockedVersion?.panels?.length) {
                merged.storyboardVersions = {
                  ...(merged.storyboardVersions ?? {}),
                  [key]: lockedVersion,
                };
                merged.selectedVersion = key;
                merged.storyboardLocked = true;
              }
            }
            if (prevPro?.sellpointsLocked && prevPro.sellpoints?.length) {
              merged.sellpoints = prevPro.sellpoints;
              merged.sellpointsLocked = true;
            }
            if (proPromptPhase === "storyboards" && prevPro?.storyboardVersions) {
              merged.storyboardVersions = {
                ...(prevPro.storyboardVersions ?? {}),
                ...(merged.storyboardVersions ?? {}),
              };
            }
            const versionKey = merged.selectedVersion ?? undefined;
            const systemMarkdown = renderProDeliverableMarkdown(merged, {
              versionKey,
              includeAllVersions: !versionKey,
            });
            const proPhase = inferProPhaseFromDeliverable(merged);
            patch.meta = {
              ...existingMeta,
              deliverable: merged,
              deliverableMarkdown: systemMarkdown || briefText,
              workflow: {
                ...existingWorkflow,
                vertical: proVerticalId,
                proPhase,
                ...(merged.sellpointsLocked ? { proSellpointsEdited: false } : {}),
                ...(merged.storyboardLocked ? { proStoryboardPanelsEdited: false } : {}),
              },
            };
            patch.status = "deliverable_ready";
          } else if (briefText.length > 200 && (isFashion || isProVertical)) {
            patch.meta = {
              ...existingMeta,
              deliverableMarkdown: briefText,
            };
          }

          await updateEcomStoryboardProject(auth.userId, projectId, patch);

          if (gatewayLogId) {
            await ensureGatewayChatLogSucceededAfterStream({
              logId: gatewayLogId,
            }).catch((e) => {
              console.warn(
                "[storyboard-assistant-chat] gateway log finalize fallback failed",
                gatewayLogId,
                e instanceof Error ? e.message : e,
              );
            });
          }

          controller.close();
        } catch (e) {
          if (fullText.trim().length === 0) {
            controller.error(e);
          } else {
            try {
              controller.close();
            } catch {
              /* ignore */
            }
          }
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
