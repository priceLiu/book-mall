import { cookies } from "next/headers";
import { requireToolSuiteNavAccess } from "@/lib/require-tools-api-access";
import { chatStreamFromGateway } from "@/lib/forward-gateway-chat-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 与界面一致的客服人设（服务端强制，防止客户端篡改 system）。 */
const SMART_SUPPORT_SYSTEM_PROMPT = `你是「智选 AI Mall」工具站的 AI智能客服助手。语气专业、简洁、友好。
帮助用户理解订阅与余额、试衣间与 AI 试衣、文生图与图片库、费用明细与 SSO 登录等说明。
若涉及具体订单提现、账号风控或需核实身份的操作，请引导用户前往主站「个人中心」或联系人工客服。
回答尽量使用简体中文，除非用户明确要求其他语言。`;

const MAX_MESSAGES = 48;
const MAX_CONTENT_CHARS = 12000;

type ClientTurn = { role: string; content: unknown };

function sanitizeChatMessages(raw: unknown): { role: "user" | "assistant"; content: string }[] {
  if (!Array.isArray(raw)) {
    throw new Error("messages_must_be_array");
  }
  const slice = raw.slice(-MAX_MESSAGES);
  const out: { role: "user" | "assistant"; content: string }[] = [];
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
  const suite = await requireToolSuiteNavAccess("smart-support");
  if (!suite.ok) return suite.response;

  const token = cookies().get("tools_token")?.value?.trim();
  if (!token) {
    return new Response(JSON.stringify({ error: "请先登录工具站" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
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

  let userAssistantTurns: { role: "user" | "assistant"; content: string }[];
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

  const lastTurn = userAssistantTurns[userAssistantTurns.length - 1]!;
  if (lastTurn.role !== "user") {
    return new Response(JSON.stringify({ error: "最后一条消息须为用户提问" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const gw = await chatStreamFromGateway({
    model: "deepseek-chat",
    messages: [
      { role: "system", content: SMART_SUPPORT_SYSTEM_PROMPT },
      ...userAssistantTurns,
    ],
    clientPage: "smart-support/chat",
  });

  if (!gw.ok) {
    const message =
      gw.reason === "no_session"
        ? "请先登录工具站"
        : gw.reason === "no_origin"
          ? "工具站未配置 MAIN_SITE_ORIGIN"
          : gw.message ?? gw.error ?? "Gateway 调用失败";
    const code = gw.code ?? "";
    const isKeyRequired = code === "GATEWAY_KEY_REQUIRED";
    const status =
      gw.reason === "no_session"
        ? 401
        : gw.reason === "no_origin"
          ? 503
          : isKeyRequired
            ? 403
            : gw.status && gw.status >= 400 && gw.status < 600
              ? gw.status
              : 502;
    return new Response(
      JSON.stringify({
        error: isKeyRequired ? "gateway_key_required" : "gateway_error",
        message,
        code: code || undefined,
      }),
      { status, headers: { "Content-Type": "application/json" } },
    );
  }

  const upstream = gw.response;
  if (!upstream.body) {
    return new Response(JSON.stringify({ error: "upstream_empty" }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const readable = new ReadableStream({
    async start(controller) {
      const reader = upstream.body!.getReader();
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
              if (piece) controller.enqueue(encoder.encode(piece));
            } catch {
              /* ignore */
            }
          }
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      } finally {
        reader.releaseLock();
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
