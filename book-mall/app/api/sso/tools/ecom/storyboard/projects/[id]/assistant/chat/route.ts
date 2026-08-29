import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
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
  stripFashionDeliverableFence,
} from "@/lib/ecom/ecom-fashion-deliverable";
import { renderFashionDeliverableMarkdown } from "@/lib/ecom/ecom-fashion-deliverable-render";
import { buildStoryboardAssistantSystemPrompt } from "@/lib/ecom/ecom-storyboard-assistant-prompts";
import {
  extractStoryboardDeliverable,
  stripDeliverableFence,
} from "@/lib/ecom/ecom-storyboard-deliverable";
import { renderDeliverableMarkdown } from "@/lib/ecom/ecom-storyboard-deliverable-render";
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
  const isFashion = isFashionWorkflow(existingMeta);
  const lastUserTurn = turns[turns.length - 1]!.content.trim();
  const fashionPromptPhase = isFashion ? resolveFashionPromptPhase(lastUserTurn) : "general";
  const prevFashionDeliverable =
    isFashion && isFashionDeliverable(existingMeta.deliverable)
      ? existingMeta.deliverable
      : null;
  let systemPrompt = isFashion
    ? buildFashionAssistantSystemPrompt(fashionPromptPhase)
    : buildStoryboardAssistantSystemPrompt();
  if (prevFashionDeliverable && fashionPromptPhase !== "sellpoints" && fashionPromptPhase !== "general") {
    systemPrompt += buildFashionDeliverableContextBlock(
      prevFashionDeliverable,
      fashionPromptPhase,
    );
  }

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const gw = await ecomGwChatStream(auth.userId, {
      modelKey,
      messages: [{ role: "system", content: systemPrompt }, ...turns],
      clientPage: ecomClientPage(auth.userId, projectId, ECOM_STORYBOARD_TOOL_KEY),
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
                /* ignore */
              }
            }
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

          let deliverable = extractStoryboardDeliverable(fullText);
          const fashionDeliverable = isFashion
            ? extractFashionDeliverable(fullText)
            : null;
          const briefText = isFashion
            ? stripFashionDeliverableFence(fullText)
            : stripDeliverableFence(fullText);
          const existingWorkflow =
            (existingMeta.workflow as Record<string, unknown> | undefined) ?? {};
          const isSceneAdjust = lastUserTurn.startsWith("场景参考已确认 |");
          const schemeAlreadyPicked = existingWorkflow.schemePicked === true;
          const patch: Parameters<typeof updateEcomStoryboardProject>[2] = {
            chatHistory: history,
          };

          if (isFashion && fashionDeliverable) {
            const prevFashion = existingMeta.deliverable as
              | Parameters<typeof mergeFashionDeliverablePatch>[0]
              | undefined;
            const llmFashionPatch =
              fashionPromptPhase === "voiceovers" && !prevFashion?.selectedVoiceoverId
                ? { ...fashionDeliverable, selectedVoiceoverId: null }
                : fashionDeliverable;
            const merged = mergeFashionDeliverablePatch(
              prevFashion,
              llmFashionPatch,
              typeof existingMeta.productName === "string"
                ? existingMeta.productName
                : fashionDeliverable.productName,
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
          } else if (deliverable) {
            const schemes = deliverable.schemes ?? [];
            const multiScheme = schemes.length > 1;
            const selectedIndex = multiScheme
              ? schemeAlreadyPicked &&
                typeof existingMeta.selectedSchemeIndex === "number"
                ? existingMeta.selectedSchemeIndex
                : undefined
              : 0;
            const systemMarkdown = renderDeliverableMarkdown(deliverable, {
              schemeIndex: selectedIndex ?? 0,
              includeAllSchemes: multiScheme && !schemeAlreadyPicked,
            });
            patch.meta = {
              ...existingMeta,
              deliverable,
              deliverableMarkdown: systemMarkdown || briefText,
              ...(selectedIndex !== undefined
                ? { selectedSchemeIndex: selectedIndex }
                : multiScheme
                  ? { selectedSchemeIndex: undefined }
                  : { selectedSchemeIndex: 0 }),
              workflow: {
                ...existingWorkflow,
                schemePicked: multiScheme ? schemeAlreadyPicked : true,
                phase:
                  multiScheme && !schemeAlreadyPicked
                    ? "planning"
                    : existingWorkflow.phase ?? "refs",
                awaitingCustomSceneInput: false,
                ...(isSceneAdjust ? { awaitingSceneApplyMode: false } : {}),
              },
            };
            patch.status = "deliverable_ready";
          } else if (briefText.length > 200) {
            patch.meta = {
              ...existingMeta,
              deliverableMarkdown: briefText,
            };
          }

          await updateEcomStoryboardProject(auth.userId, projectId, patch);

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
