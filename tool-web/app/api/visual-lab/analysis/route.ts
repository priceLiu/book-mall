import OpenAI from "openai";
import { requireToolSuiteNavAccess } from "@/lib/require-tools-api-access";
import { getDashscopeOpenAiCompatBaseUrl } from "@/lib/dashscope-openai-env";
import { getQwenApiKey } from "@/lib/qwen-env";
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
): OpenAI.Chat.ChatCompletionContentPart[] {
  const parts: OpenAI.Chat.ChatCompletionContentPart[] = [];
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
      } as unknown as OpenAI.Chat.ChatCompletionContentPart);
    }
  }
  parts.push({ type: "text", text: prompt });
  return parts;
}

export async function POST(req: Request) {
  const gate = await requireToolSuiteNavAccess("visual-lab");
  if (!gate.ok) return gate.response;

  const apiKey = getQwenApiKey();
  if (!apiKey) {
    return Response.json(
      { error: "missing_api_key", message: "服务端未配置 QWEN_API_KEY 或 DASHSCOPE_API_KEY" },
      { status: 503 },
    );
  }

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

  let userContent: OpenAI.Chat.ChatCompletionContentPart[];
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

  const client = new OpenAI({
    apiKey,
    baseURL: getDashscopeOpenAiCompatBaseUrl(),
  });

  type CreateBody = OpenAI.Chat.ChatCompletionCreateParamsNonStreaming & {
    enable_thinking?: boolean;
    thinking_budget?: number;
  };

  const createParams: CreateBody = {
    model: meta.apiModel,
    messages: [{ role: "user", content: userContent }],
    ...(enableThinking
      ? { enable_thinking: true, thinking_budget: thinkingBudget }
      : {}),
  };

  try {
    const completion = await client.chat.completions.create(createParams);

    const choice = completion.choices[0];
    const msg = choice?.message as
      | (OpenAI.Chat.ChatCompletionMessage & {
          reasoning_content?: string | null;
        })
      | undefined;

    const contentRaw = msg?.content as unknown;
    let content = "";
    if (typeof contentRaw === "string") {
      content = contentRaw;
    } else if (Array.isArray(contentRaw)) {
      const chunks: string[] = [];
      for (const p of contentRaw) {
        if (p && typeof p === "object" && "text" in p && typeof (p as { text?: unknown }).text === "string") {
          chunks.push((p as { text: string }).text);
        }
      }
      content = chunks.join("");
    }

    const reasoning =
      typeof msg?.reasoning_content === "string" ? msg.reasoning_content.trim() : "";

    return Response.json({
      ok: true,
      model: meta.apiModel,
      content: content || "",
      reasoning: reasoning || undefined,
      usage: completion.usage,
    });
  } catch (e: unknown) {
    const status =
      e && typeof e === "object" && "status" in e && typeof (e as { status: unknown }).status === "number"
        ? (e as { status: number }).status
        : 502;
    const message =
      e && typeof e === "object" && "message" in e && typeof (e as Error).message === "string"
        ? (e as Error).message
        : "upstream_error";
    return Response.json(
      { error: "dashscope_error", message, detail: String(message) },
      { status: status >= 400 && status < 600 ? status : 502 },
    );
  }
}
