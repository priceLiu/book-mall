import { requireToolSuiteNavAccess } from "@/lib/require-tools-api-access";
import { chatStreamFromGateway } from "@/lib/forward-gateway-chat-server";
import {
  getVisualLabAnalysisModelById,
  VISUAL_LAB_ANALYSIS_MODELS,
} from "@/lib/visual-lab-analysis-models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_PROMPT_CHARS = 24_000;
/** 单路附件解码后上限（与前端 100MB 图上限对齐会过大，此处拦一层防止误传） */
const MAX_DECODED_BYTES_PER_PART = 22 * 1024 * 1024;

type AttKind = "image" | "video" | "doc";

type AttachmentPayload = {
  kind: AttKind;
  name: string;
  mimeType: string;
  base64: string;
};

type Body = {
  modelId?: unknown;
  prompt?: unknown;
  enableThinking?: unknown;
  thinkingBudget?: unknown;
  attachments?: unknown;
};

function isAttKind(k: unknown): k is AttKind {
  return k === "image" || k === "video" || k === "doc";
}

function sanitizeAttachments(raw: unknown): AttachmentPayload[] {
  if (!Array.isArray(raw)) throw new Error("attachments_invalid");
  if (raw.length > 6) throw new Error("attachments_too_many");
  const out: AttachmentPayload[] = [];
  const kinds = new Set<AttKind>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const kind = o.kind;
    const name = o.name;
    const mimeType = o.mimeType;
    const base64 = o.base64;
    if (!isAttKind(kind)) throw new Error("attachment_kind_invalid");
    if (typeof name !== "string" || !name.trim()) throw new Error("attachment_name_invalid");
    if (typeof mimeType !== "string" || !mimeType.trim()) throw new Error("attachment_mime_invalid");
    if (typeof base64 !== "string" || !base64.trim()) throw new Error("attachment_data_invalid");
    kinds.add(kind);
    if (kinds.size > 1) throw new Error("attachments_mixed_kinds");
    const buf = Buffer.from(base64, "base64");
    if (buf.length > MAX_DECODED_BYTES_PER_PART) throw new Error("attachment_too_large");
    out.push({ kind, name: name.trim(), mimeType: mimeType.trim(), base64 });
  }
  if (kinds.has("image") && out.length > 5) throw new Error("too_many_images");
  if (kinds.has("video") && out.length > 1) throw new Error("too_many_videos");
  if (kinds.has("doc") && out.length > 1) throw new Error("too_many_docs");
  return out;
}

function docToTextPart(name: string, mime: string, buf: Buffer): { type: "text"; text: string } {
  const lower = name.toLowerCase();
  const textMime =
    mime === "text/plain" ||
    mime === "text/markdown" ||
    mime === "text/x-markdown" ||
    lower.endsWith(".txt") ||
    lower.endsWith(".md");
  if (!textMime) {
    throw new Error(
      "doc_format_unsupported: 仅支持 .txt / .md 纯文本附件；PDF/Word 请先导出为文本或转为图片后上传（参见 ivo.md）。",
    );
  }
  const text = buf.toString("utf8");
  const cap = 120_000;
  const body = text.length > cap ? `${text.slice(0, cap)}\n…（已截断）` : text;
  return {
    type: "text",
    text: `【附件：${name}】\n${body}`,
  };
}

/** 与百炼 OpenAI 兼容多模态一致：image_url / video_url + text；见 doc/ivo.md */
function buildUserContent(
  prompt: string,
  list: AttachmentPayload[],
): { type: string; [key: string]: unknown }[] {
  const parts: { type: string; [key: string]: unknown }[] = [];
  if (list.length === 0) {
    parts.push({ type: "text", text: prompt });
    return parts;
  }

  const kind = list[0]!.kind;
  if (kind === "doc") {
    const doc = list[0]!;
    const buf = Buffer.from(doc.base64, "base64");
    const docPart = docToTextPart(doc.name, doc.mimeType, buf);
    parts.push(docPart);
    parts.push({ type: "text", text: prompt });
    return parts;
  }

  for (const a of list) {
    const dataUrl = `data:${a.mimeType};base64,${a.base64}`;
    if (a.kind === "image") {
      parts.push({ type: "image_url", image_url: { url: dataUrl } });
    } else {
      parts.push({
        type: "video_url",
        video_url: { url: dataUrl },
        fps: 2,
      });
    }
  }
  parts.push({ type: "text", text: prompt });
  return parts;
}

export async function POST(req: Request) {
  const gate = await requireToolSuiteNavAccess("visual-lab");
  if (!gate.ok) return gate.response;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const modelId =
    typeof body.modelId === "string" && body.modelId.trim()
      ? body.modelId.trim()
      : VISUAL_LAB_ANALYSIS_MODELS[0]!.id;
  const meta = getVisualLabAnalysisModelById(modelId);
  if (!meta) {
    return Response.json({ error: "unknown_model", message: "未知模型" }, { status: 400 });
  }

  const promptRaw = typeof body.prompt === "string" ? body.prompt : "";
  const prompt = promptRaw.trim();
  if (!prompt) {
    return Response.json({ error: "empty_prompt", message: "请输入分析指令" }, { status: 400 });
  }
  if (prompt.length > MAX_PROMPT_CHARS) {
    return Response.json({ error: "prompt_too_long" }, { status: 413 });
  }

  let list: AttachmentPayload[];
  try {
    list = sanitizeAttachments(body.attachments ?? []);
  } catch (e) {
    const code = e instanceof Error ? e.message : "bad_attachments";
    const status = code === "attachment_too_large" ? 413 : 400;
    const messages: Record<string, string> = {
      attachments_mixed_kinds: "不支持在同一次请求中混合多种附件类型",
      attachment_too_large: "单个附件体积超过服务端限制",
      doc_format_unsupported:
        "仅支持 .txt / .md 作为文档直传；PDF/Word 请先另存为文本或截图为图片上传",
    };
    return Response.json(
      {
        error: code,
        message: messages[code] ?? "附件参数无效",
      },
      { status },
    );
  }

  const enableThinking = body.enableThinking !== false;
  const rawBudget = body.thinkingBudget;
  const thinkingBudget =
    typeof rawBudget === "number" && Number.isFinite(rawBudget)
      ? Math.max(1024, Math.min(131_072, Math.floor(rawBudget)))
      : 8192;

  let userContent: { type: string; [key: string]: unknown }[];
  try {
    userContent = buildUserContent(prompt, list);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.startsWith("doc_format_unsupported")) {
      return Response.json(
        {
          error: "doc_format_unsupported",
          message:
            "仅支持 .txt / .md 纯文本附件；PDF/Word 请先导出为文本或转为图片后上传（参见 doc/ivo.md）。",
        },
        { status: 400 },
      );
    }
    throw e;
  }

  const streamParams: Record<string, unknown> = {
    model: meta.apiModel,
    messages: [{ role: "user", content: userContent }],
    ...(enableThinking ? { enable_thinking: true, thinking_budget: thinkingBudget } : {}),
    clientPage: "visual-lab/analysis",
  };

  const gw = await chatStreamFromGateway(streamParams);
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
            : gw.status === 402
              ? 402
              : gw.status && gw.status >= 400 && gw.status < 600
                ? gw.status
                : 502;
    return Response.json(
      {
        error: isKeyRequired ? "gateway_key_required" : "gateway_error",
        message,
        code: code || undefined,
      },
      { status },
    );
  }

  const upstream = gw.response;
  if (!upstream.body) {
    return Response.json(
      { error: "gateway_error", message: "上游未返回流式响应" },
      { status: 502 },
    );
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  type StreamEv =
    | { type: "reasoning"; text: string }
    | { type: "content"; text: string }
    | { type: "done" }
    | { type: "error"; message: string };

  const readable = new ReadableStream({
    async start(controller) {
      const send = (ev: StreamEv) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(ev)}\n`));
      };
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
            let chunk: Record<string, unknown>;
            try {
              chunk = JSON.parse(payload) as Record<string, unknown>;
            } catch {
              continue;
            }
            const upstreamErr = chunk.error as { message?: string } | undefined;
            if (typeof upstreamErr?.message === "string" && upstreamErr.message.trim()) {
              send({ type: "error", message: upstreamErr.message.trim() });
              controller.close();
              return;
            }
            const delta = (chunk.choices as { delta?: Record<string, unknown> }[] | undefined)?.[0]
              ?.delta;
            const r = delta?.reasoning_content;
            if (typeof r === "string" && r.length > 0) {
              send({ type: "reasoning", text: r });
            }
            const c = delta?.content;
            if (typeof c === "string" && c.length > 0) {
              send({ type: "content", text: c });
            }
          }
        }
        if (!sseBuffer.includes('"choices"') && !sseBuffer.includes('"error"')) {
          const trimmedBuf = sseBuffer.trim();
          if (trimmedBuf.startsWith("{")) {
            try {
              const maybe = JSON.parse(trimmedBuf) as Record<string, unknown>;
              const err = maybe.error as { message?: string } | string | undefined;
              const errMsg =
                typeof err === "string"
                  ? err
                  : typeof err?.message === "string"
                    ? err.message
                    : typeof maybe.message === "string"
                      ? maybe.message
                      : null;
              if (errMsg?.trim()) {
                send({ type: "error", message: errMsg.trim() });
                controller.close();
                return;
              }
            } catch {
              /* ignore */
            }
          }
        }
        send({ type: "done" });
        controller.close();
      } catch (err) {
        const message = err instanceof Error ? err.message : "stream_error";
        send({ type: "error", message });
        controller.close();
      } finally {
        reader.releaseLock();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
    },
  });
}
