/**
 * 影视专业版 · 上传剧本（Markdown / 纯文本）
 */
import type { CanvasGraph } from "./types";
import type { StoryProUploadedScriptMeta } from "./story-pro-workspace-types";

/** MentionsTextarea / LLM 引用 token */
export const STORY_PRO_UPLOADED_SCRIPT_REF_ID = "ref-uploaded-script";

export const STORY_PRO_UPLOAD_SCRIPT_ACCEPT = ".md,.markdown,.txt,text/markdown,text/plain";

/** 单文件上限（字符数，约 200KB UTF-8） */
export const STORY_PRO_UPLOAD_SCRIPT_MAX_CHARS = 200_000;

export const STORY_PRO_UPLOAD_SCRIPT_MIN_CHARS = 80;

export type StoryProUploadScriptResult =
  | {
      ok: true;
      md: string;
      meta: StoryProUploadedScriptMeta;
    }
  | { ok: false; error: string };

function normalizeUploadedScriptText(raw: string): string {
  return raw.replace(/\r\n/g, "\n").replace(/\uFEFF/g, "").trim();
}

/** 读取并校验用户上传的剧本文件 */
export async function parseStoryProUploadScriptFile(
  file: File,
): Promise<StoryProUploadScriptResult> {
  const name = file.name.trim();
  const lower = name.toLowerCase();
  const allowed =
    lower.endsWith(".md") ||
    lower.endsWith(".markdown") ||
    lower.endsWith(".txt") ||
    file.type === "text/markdown" ||
    file.type === "text/plain" ||
    file.type === "";
  if (!allowed) {
    return {
      ok: false,
      error: "仅支持 .md / .markdown / .txt（UTF-8 文本）",
    };
  }
  if (file.size > STORY_PRO_UPLOAD_SCRIPT_MAX_CHARS * 4) {
    return {
      ok: false,
      error: `文件过大（>${Math.round(STORY_PRO_UPLOAD_SCRIPT_MAX_CHARS / 1000)}KB 文本建议拆集上传）`,
    };
  }

  let text: string;
  try {
    text = await file.text();
  } catch {
    return { ok: false, error: "无法读取文件，请确认是 UTF-8 文本" };
  }

  const md = normalizeUploadedScriptText(text);
  if (md.length < STORY_PRO_UPLOAD_SCRIPT_MIN_CHARS) {
    return {
      ok: false,
      error: `剧本过短（至少 ${STORY_PRO_UPLOAD_SCRIPT_MIN_CHARS} 字）`,
    };
  }
  if (md.length > STORY_PRO_UPLOAD_SCRIPT_MAX_CHARS) {
    return {
      ok: false,
      error: `剧本过长（>${STORY_PRO_UPLOAD_SCRIPT_MAX_CHARS.toLocaleString()} 字），请拆集或删减`,
    };
  }
  if (/\0/.test(md)) {
    return { ok: false, error: "检测到二进制内容，请上传纯文本/Markdown" };
  }

  const format: StoryProUploadedScriptMeta["format"] = lower.endsWith(".txt")
    ? "txt"
    : "md";

  return {
    ok: true,
    md,
    meta: {
      fileName: name,
      format,
      charCount: md.length,
      uploadedAt: new Date().toISOString(),
    },
  };
}

export function formatUploadedScriptForLlm(args: {
  md: string;
  meta?: StoryProUploadedScriptMeta | null;
}): string {
  const title = args.meta?.fileName ?? "上传剧本";
  const fmt = args.meta?.format === "txt" ? "纯文本" : "Markdown";
  return `# 上传剧本 · ${title}\n\n> 格式：${fmt} · ${args.meta?.charCount ?? args.md.length} 字\n\n${args.md.trim()}`;
}

export function storyProUploadedScriptMentionLabel(
  meta?: StoryProUploadedScriptMeta | null,
): string {
  if (!meta?.fileName) return "上传剧本";
  return `上传剧本 · ${meta.fileName}`;
}

/** autosave 前剥离节点内大段剧本文本，仅保留 OSS URL */
export function stripStoryProUploadedScriptMdForPersist(
  graph: CanvasGraph,
): CanvasGraph {
  return {
    ...graph,
    nodes: graph.nodes.map((n) => {
      if (n.type !== "story-pro-starter") return n;
      const data = { ...(n.data ?? {}) } as Record<string, unknown>;
      delete data.uploadedScriptMd;
      return { ...n, data };
    }),
  };
}

export async function fetchUploadedScriptFromOss(ossUrl: string): Promise<string> {
  const r = await fetch(ossUrl, { cache: "no-store" });
  if (!r.ok) {
    throw new Error(`读取剧本失败（HTTP ${r.status}）`);
  }
  return normalizeUploadedScriptText(await r.text());
}
