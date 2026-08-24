/**
 * 平台 AI 导览助手 · 对话端点（SSE 流式）。
 */
import {
  classifyUserFeedbackCategory,
  shouldLogUnansweredQuestion,
} from "@/lib/platform-assistant/feedback-classifier";
import {
  appendAssistantUnansweredFollowUp,
  assistantUnansweredFollowUp,
  needsAssistantUnansweredFollowUp,
} from "@/lib/platform-assistant/unanswered-follow-up";
import { createPlatformAssistantFeedback } from "@/lib/platform-assistant/feedback-service";
import {
  isSensitiveTopic,
  sensitiveTopicReply,
} from "@/lib/platform-assistant/guardrails";
import { resolveCuratedAssistantAnswer } from "@/lib/platform-assistant/qa-service";
import {
  isGenerationIntent,
  isPlatformOverviewIntent,
  listAllPlatformAppLinks,
  matchRedirect,
} from "@/lib/platform-assistant/redirect-map";
import { retrieveChunks } from "@/lib/platform-assistant/retriever";
import { buildSystemPrompt } from "@/lib/platform-assistant/system-prompt";
import {
  platformChatStream,
  PlatformAssistantGatewayError,
} from "@/lib/platform-assistant/platform-gateway";
import {
  ASSISTANT_MAX_TOKENS,
  ASSISTANT_RATE_LIMIT,
  ASSISTANT_GUEST_RATE_LIMIT,
  isPureGreeting,
} from "@/lib/platform-assistant/config";
import { getAssistantChatRuntimeConfig } from "@/lib/platform-assistant/platform-assistant-model-config-service";
import { resolveAssistantActor } from "@/lib/platform-assistant/assistant-actor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type ChatMessage = { role: string; content: string };

const encoder = new TextEncoder();

const rateBuckets = new Map<string, number[]>();
function rateLimited(
  key: string,
  limit: { windowMs: number; max: number },
): boolean {
  const now = Date.now();
  const { windowMs, max } = limit;
  const arr = (rateBuckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= max) {
    rateBuckets.set(key, arr);
    return true;
  }
  arr.push(now);
  rateBuckets.set(key, arr);
  return false;
}

function sseLine(obj: unknown): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(obj)}\n\n`);
}

function contentDelta(text: string): Uint8Array {
  return sseLine({ choices: [{ delta: { content: text }, index: 0 }] });
}

const DONE = encoder.encode("data: [DONE]\n\n");
const HEARTBEAT = encoder.encode(": open\n\n");

function sseResponse(body: ReadableStream<Uint8Array>, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
      Connection: "keep-alive",
    },
  });
}

function parseSourceMeta(request: Request): {
  sourceApp: string | null;
  pageUrl: string | null;
} {
  const sourceApp = request.headers.get("x-platform-app")?.trim() || null;
  const pageUrl = request.headers.get("referer")?.trim() || null;
  return { sourceApp, pageUrl };
}

function extractContentDeltaFromChunk(chunk: Uint8Array): string {
  const text = new TextDecoder().decode(chunk);
  let out = "";
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t.startsWith("data:")) continue;
    const payload = t.slice(5).trim();
    if (!payload || payload === "[DONE]") continue;
    try {
      const json = JSON.parse(payload) as {
        choices?: { delta?: { content?: string } }[];
      };
      const delta = json.choices?.[0]?.delta?.content;
      if (typeof delta === "string") out += delta;
    } catch {
      /* partial */
    }
  }
  return out;
}

async function logFeedbackSafe(input: Parameters<typeof createPlatformAssistantFeedback>[0]) {
  try {
    await createPlatformAssistantFeedback(input);
  } catch (e) {
    console.error("[platform-assistant] feedback log failed:", (e as Error).message);
  }
}

export async function POST(request: Request) {
  const actor = await resolveAssistantActor(request);
  const userId = actor.userId;

  const limit = actor.isGuest ? ASSISTANT_GUEST_RATE_LIMIT : ASSISTANT_RATE_LIMIT;
  if (rateLimited(actor.rateLimitKey, limit)) {
    return Response.json(
      { error: "请求过于频繁，请稍后再试" },
      { status: 429 },
    );
  }

  let body: { messages?: ChatMessage[] };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const history = Array.isArray(body.messages) ? body.messages : [];
  const cleaned = history
    .filter(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim().length > 0,
    )
    .slice(-8)
    .map((m) => ({ role: m.role, content: m.content.trim() }));

  const lastUser = [...cleaned].reverse().find((m) => m.role === "user");
  const query = lastUser?.content ?? "";
  if (!query) {
    return Response.json({ error: "缺少用户消息" }, { status: 400 });
  }

  const { sourceApp, pageUrl } = parseSourceMeta(request);
  const isOverview = isPlatformOverviewIntent(query);
  const isGreeting = isPureGreeting(query);
  let chunkCount = 0;
  let assistantReply = "";
  const chatConfig = await getAssistantChatRuntimeConfig();
  if (!chatConfig.enabled) {
    return Response.json({ error: "AI 小智对话已在管理后台关闭" }, { status: 503 });
  }

  async function logFeedbackAfterReply() {
    if (!userId) return;
    const userCategory = classifyUserFeedbackCategory(query);
    if (userCategory === "BUG" || userCategory === "FEATURE_REQUEST") {
      await logFeedbackSafe({
        userId,
        category: userCategory,
        userMessage: query,
        assistantReply,
        sourceApp,
        pageUrl,
      });
      return;
    }
    if (
      shouldLogUnansweredQuestion({
        query,
        chunkCount,
        isOverview,
        isGreeting,
        assistantReply,
      })
    ) {
      await logFeedbackSafe({
        userId,
        category: "QUESTION",
        userMessage: query,
        assistantReply,
        sourceApp,
        pageUrl,
      });
    }
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const finish = async () => {
        if (
          shouldLogUnansweredQuestion({
            query,
            chunkCount,
            isOverview,
            isGreeting,
            assistantReply,
          }) &&
          needsAssistantUnansweredFollowUp(assistantReply)
        ) {
          const block = `\n\n${assistantUnansweredFollowUp()}`;
          assistantReply = appendAssistantUnansweredFollowUp(assistantReply);
          controller.enqueue(contentDelta(block));
        }
        controller.enqueue(DONE);
        controller.close();
        await logFeedbackAfterReply();
      };

      try {
        controller.enqueue(HEARTBEAT);

        if (isSensitiveTopic(query)) {
          assistantReply = sensitiveTopicReply();
          controller.enqueue(contentDelta(assistantReply));
          await finish();
          return;
        }

        const curatedAnswer = await resolveCuratedAssistantAnswer(query);
        if (curatedAnswer) {
          assistantReply = curatedAnswer;
          controller.enqueue(contentDelta(curatedAnswer));
          await finish();
          return;
        }

        if (isOverview) {
          const links = listAllPlatformAppLinks();
          controller.enqueue(sseLine({ assistantAppLinks: links }));
          assistantReply = "我们平台主要有以下应用，点击卡片可在新标签页打开：";
          controller.enqueue(contentDelta(assistantReply));
          await finish();
          return;
        }

        const redirect = isGenerationIntent(query) ? matchRedirect(query) : null;
        if (redirect) controller.enqueue(sseLine({ assistantRedirect: redirect }));

        let chunks: Awaited<ReturnType<typeof retrieveChunks>> = [];
        if (!isGreeting) {
          try {
            chunks = await retrieveChunks(query);
            chunkCount = chunks.length;
          } catch (e) {
            console.error(
              "[platform-assistant] retrieve failed:",
              (e as Error).message,
            );
          }
        }

        const systemPrompt = buildSystemPrompt({ chunks, redirect });
        const messages = [{ role: "system", content: systemPrompt }, ...cleaned];

        let streamed;
        try {
          streamed = await platformChatStream({
            model: chatConfig.modelKey,
            fallbackModels: chatConfig.fallbackModelKeys,
            messages,
            maxTokens: ASSISTANT_MAX_TOKENS,
            clientPage: "platform-assistant/chat",
          });
        } catch (e) {
          if (e instanceof PlatformAssistantGatewayError) {
            assistantReply = redirect
              ? `${redirect.description}\n\n打开：${redirect.url}`
              : `助手暂时不可用：${e.message}`;
          } else {
            assistantReply = `助手出错了：${(e as Error).message}`;
          }
          controller.enqueue(contentDelta(assistantReply));
          await finish();
          return;
        }

        const reader = streamed.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);
          assistantReply += extractContentDeltaFromChunk(value);
        }
        await finish();
      } catch (err) {
        try {
          controller.enqueue(contentDelta("连接中断，请重试。"));
          controller.enqueue(DONE);
          controller.close();
        } catch {
          /* */
        }
        console.error("[platform-assistant] stream error:", (err as Error).message);
      }
    },
  });

  return sseResponse(stream);
}
