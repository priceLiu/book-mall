/**
 * 平台 AI 导览助手 · 对话端点（SSE 流式）。
 * 面向全部注册用户，平台代付 DeepSeek，无积分、无订阅门禁。
 * 价格/财务护栏 + pgvector 检索 + 图片/视频引导卡。
 */
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";
import {
  isSensitiveTopic,
  sensitiveTopicReply,
} from "@/lib/platform-assistant/guardrails";
import {
  isGenerationIntent,
  matchRedirect,
} from "@/lib/platform-assistant/redirect-map";
import { retrieveChunks } from "@/lib/platform-assistant/retriever";
import { buildSystemPrompt } from "@/lib/platform-assistant/system-prompt";
import {
  platformChatStream,
  PlatformAssistantGatewayError,
} from "@/lib/platform-assistant/platform-gateway";
import {
  ASSISTANT_CHAT_MODEL,
  ASSISTANT_MAX_TOKENS,
  ASSISTANT_RATE_LIMIT,
  isPureGreeting,
} from "@/lib/platform-assistant/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type ChatMessage = { role: string; content: string };

const encoder = new TextEncoder();

/** 进程内每用户限流（简单滑动窗口）。 */
const rateBuckets = new Map<string, number[]>();
function rateLimited(userId: string): boolean {
  const now = Date.now();
  const { windowMs, max } = ASSISTANT_RATE_LIMIT;
  const arr = (rateBuckets.get(userId) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= max) {
    rateBuckets.set(userId, arr);
    return true;
  }
  arr.push(now);
  rateBuckets.set(userId, arr);
  return false;
}

function sseLine(obj: unknown): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(obj)}\n\n`);
}

/** 作为一段 assistant 内容增量发送（用于本地固定话术 / 错误提示）。 */
function contentDelta(text: string): Uint8Array {
  return sseLine({ choices: [{ delta: { content: text }, index: 0 }] });
}

const DONE = encoder.encode("data: [DONE]\n\n");
/** SSE 心跳注释：立即刷出首字节，前端马上显示「正在输入」。 */
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

/** 优先工具站 Bearer（子站经 BFF）；主站浏览器无 Bearer 时回退 NextAuth 会话。 */
async function resolveUserId(request: Request): Promise<string | null> {
  const auth = verifyToolsBearer(request);
  if (auth.ok) return auth.userId;
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}

export async function POST(request: Request) {
  const userId = await resolveUserId(request);
  if (!userId) {
    return Response.json({ error: "请先登录" }, { status: 401 });
  }

  if (rateLimited(userId)) {
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

  // 立即返回 SSE 流：先刷心跳（前端秒显「正在输入」），检索与大模型调用都在流内进行。
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const finish = () => {
        controller.enqueue(DONE);
        controller.close();
      };
      try {
        controller.enqueue(HEARTBEAT);

        // 护栏：价格/财务/计算规则一律不进模型
        if (isSensitiveTopic(query)) {
          controller.enqueue(contentDelta(sensitiveTopicReply()));
          finish();
          return;
        }

        // 图片/视频生成诉求 → 引导卡（不在助手内执行）
        const redirect = isGenerationIntent(query) ? matchRedirect(query) : null;
        if (redirect) controller.enqueue(sseLine({ assistantRedirect: redirect }));

        // 纯寒暄跳过检索，避免无谓 embedding 往返
        let chunks: Awaited<ReturnType<typeof retrieveChunks>> = [];
        if (!isPureGreeting(query)) {
          try {
            chunks = await retrieveChunks(query);
          } catch (e) {
            // 检索失败（向量库/embedding 异常）降级为无知识回答，仍受护栏约束
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
            model: ASSISTANT_CHAT_MODEL,
            messages,
            maxTokens: ASSISTANT_MAX_TOKENS,
            clientPage: "platform-assistant/chat",
          });
        } catch (e) {
          if (e instanceof PlatformAssistantGatewayError) {
            controller.enqueue(
              contentDelta(
                redirect
                  ? `${redirect.description}\n\n打开：${redirect.url}`
                  : `助手暂时不可用：${e.message}`,
              ),
            );
          } else {
            controller.enqueue(contentDelta(`助手出错了：${(e as Error).message}`));
          }
          finish();
          return;
        }

        const reader = streamed.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);
        }
        controller.close();
      } catch (err) {
        try {
          controller.enqueue(contentDelta("连接中断，请重试。"));
          controller.enqueue(DONE);
        } catch {
          /* controller 可能已关闭 */
        }
        try {
          controller.close();
        } catch {
          /* already closed */
        }
        console.error("[platform-assistant] stream error:", (err as Error).message);
      }
    },
  });

  return sseResponse(stream);
}
