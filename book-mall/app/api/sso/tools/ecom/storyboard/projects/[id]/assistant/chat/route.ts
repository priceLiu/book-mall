import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { buildStoryboardAssistantSystemPrompt } from "@/lib/ecom/ecom-storyboard-assistant-prompts";
import {
  extractStoryboardDeliverable,
  schemeToSheet,
  stripDeliverableFence,
} from "@/lib/ecom/ecom-storyboard-deliverable";
import { parseStoryboardSchemesFromMarkdown } from "@/lib/ecom/ecom-storyboard-markdown-parse";
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
import { shouldMeterEcomToolkitUsage } from "@/lib/ecom/ecom-billing-mode";
import { resolveBillableSnapshot } from "@/lib/tool-billable-price";
import { recordToolUsageAndConsumeWallet } from "@/lib/wallet-record-tool-usage-consume";
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
  const systemPrompt = buildStoryboardAssistantSystemPrompt();

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
          const displayMarkdown = stripDeliverableFence(fullText);
          if (!deliverable?.schemes?.length && displayMarkdown.length > 200) {
            const parsed = parseStoryboardSchemesFromMarkdown(displayMarkdown);
            if (parsed.length > 0) {
              deliverable = { ...(deliverable ?? {}), schemes: parsed };
            }
          }
          const existingMeta =
            (project.meta as Record<string, unknown> | null) ?? {};
          const patch: Parameters<typeof updateEcomStoryboardProject>[2] = {
            chatHistory: history,
          };

          if (deliverable) {
            const selectedIndex =
              typeof existingMeta.selectedSchemeIndex === "number"
                ? existingMeta.selectedSchemeIndex
                : 0;
            const scheme = deliverable.schemes?.[selectedIndex] ?? deliverable.schemes?.[0];
            patch.meta = {
              ...existingMeta,
              deliverable,
              deliverableMarkdown: displayMarkdown,
              selectedSchemeIndex: scheme ? selectedIndex : 0,
            };
            if (scheme) {
              patch.sheet = schemeToSheet(scheme, deliverable);
              patch.status = "sheet_ready";
            } else {
              patch.status = "deliverable_ready";
            }
          } else if (displayMarkdown.length > 200) {
            patch.meta = {
              ...existingMeta,
              deliverableMarkdown: displayMarkdown,
            };
          }

          await updateEcomStoryboardProject(auth.userId, projectId, patch);

          const metered = await shouldMeterEcomToolkitUsage(
            auth.userId,
            ECOM_STORYBOARD_TOOL_KEY,
          );
          if (metered) {
            const snap = await resolveBillableSnapshot(
              ECOM_STORYBOARD_TOOL_KEY,
              "chat",
              { userId: auth.userId },
            );
            if (snap && snap.points > 0) {
              await recordToolUsageAndConsumeWallet({
                userId: auth.userId,
                toolKey: ECOM_STORYBOARD_TOOL_KEY,
                action: "chat",
                costPoints: snap.points,
                meta: { projectId, modelKey },
              });
            }
          }

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
