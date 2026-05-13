import { cookies } from "next/headers";
import OpenAI from "openai";
import { getDeepseekApiKey } from "@/lib/deepseek-env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 与界面一致的客服人设（服务端强制，防止客户端篡改 system）。 */
const SMART_SUPPORT_SYSTEM_PROMPT = `你是「智选 AI Mall」工具站的智能客服助手。语气专业、简洁、友好。
帮助用户理解订阅与余额、试衣间与 AI 试衣、文生图与图片库、费用明细与 SSO 登录等说明。
若涉及具体订单退款、账号风控或需核实身份的操作，请引导用户前往主站「个人中心」或联系人工客服。
回答尽量使用简体中文，除非用户明确要求其他语言。`;

const MAX_MESSAGES = 48;
const MAX_CONTENT_CHARS = 12000;

type ClientTurn = { role: string; content: unknown };

function sanitizeChatMessages(raw: unknown): OpenAI.Chat.ChatCompletionMessageParam[] {
  if (!Array.isArray(raw)) {
    throw new Error("messages_must_be_array");
  }
  const slice = raw.slice(-MAX_MESSAGES);
  const out: OpenAI.Chat.ChatCompletionMessageParam[] = [];
  for (const item of slice) {
    if (!item || typeof item !== "object") continue;
    const { role, content } = item as ClientTurn;
    if (role !== "user" && role !== "assistant") continue;
    if (typeof content !== "string") continue;
    const text = content.trim();
    if (!text) continue;
    if (text.length > MAX_CONTENT_CHARS) {
      throw new Error("message_too_long");
    }
    out.push({ role, content: text });
  }
  return out;
}

export async function POST(req: Request) {
  const token = cookies().get("tools_token")?.value?.trim();
  if (!token) {
    return new Response(JSON.stringify({ error: "请先登录工具站" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = getDeepseekApiKey();
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "服务端未配置 DEEPSEEK_API_KEY，无法调用 DeepSeek" }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  let body: { messages?: unknown };
  try {
    body = (await req.json()) as { messages?: unknown };
  } catch {
    return new Response(JSON.stringify({ error: "请求体须为 JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  let userAssistantTurns: OpenAI.Chat.ChatCompletionMessageParam[];
  try {
    userAssistantTurns = sanitizeChatMessages(body.messages);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "invalid_messages";
    const status = msg === "message_too_long" ? 413 : 400;
    return new Response(JSON.stringify({ error: msg }), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (userAssistantTurns.length === 0) {
    return new Response(JSON.stringify({ error: "至少需要一条用户消息" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const lastTurn = userAssistantTurns[userAssistantTurns.length - 1];
  if (lastTurn.role !== "user") {
    return new Response(JSON.stringify({ error: "最后一条消息须为用户提问" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: SMART_SUPPORT_SYSTEM_PROMPT },
    ...userAssistantTurns,
  ];

  const client = new OpenAI({
    baseURL: "https://api.deepseek.com",
    apiKey,
  });

  let stream: AsyncIterable<OpenAI.Chat.ChatCompletionChunk>;
  try {
    stream = await client.chat.completions.create({
      model: "deepseek-chat",
      messages,
      stream: true,
    });
  } catch (e) {
    const message =
      e && typeof e === "object" && "message" in e && typeof (e as Error).message === "string"
        ? (e as Error).message
        : "upstream_error";
    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const piece = chunk.choices[0]?.delta?.content ?? "";
          if (piece) controller.enqueue(encoder.encode(piece));
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
    },
  });
}
