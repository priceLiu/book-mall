import type { Pro2PromptBlock } from "@/lib/canvas/pro2-prompt-template-types";
import { parsePro2ProductionScriptEnvelopeRaw } from "@/lib/canvas/pro2-production-script-structured";

const JSON_FENCE_RE = /```(json|pro2-production-script)\s*([\s\S]*?)```/gi;

function tryParseJson(
  raw: string,
  blockLabel: string,
  hint: string,
): { ok: true; value: unknown } | { ok: false; error: string } {
  const text = raw.trim();
  if (!text) return { ok: true, value: null };
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "解析失败";
    return {
      ok: false,
      error: `「${blockLabel}」${hint} JSON 无效：${msg}`,
    };
  }
}

function validateJsonSnippetsInBlock(block: Pro2PromptBlock): string | null {
  const content = block.content ?? "";
  if (!content.trim()) return null;

  JSON_FENCE_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = JSON_FENCE_RE.exec(content)) !== null) {
    const fenceTag = match[1] ?? "json";
    const fenceBody = match[2] ?? "";
    const parsed = tryParseJson(
      fenceBody,
      block.label,
      `（${fenceTag} 围栏）`,
    );
    if (!parsed.ok) return parsed.error;

    if (fenceTag === "pro2-production-script" && parsed.value != null) {
      const schema = parsePro2ProductionScriptEnvelopeRaw(parsed.value);
      if (!schema.ok) {
        return `「${block.label}」pro2-production-script 结构校验失败：${schema.error}`;
      }
    }
  }

  const trimmed = content.trim();
  if (/^[\[{]/.test(trimmed)) {
    const parsed = tryParseJson(trimmed, block.label, "全文");
    if (!parsed.ok) return parsed.error;
  }

  return null;
}

/** 保存前校验模板块；含 JSON 片段时须可解析（pro2-production-script 另做 schema 校验） */
export function validatePro2TemplateBlocksForSave(
  blocks: Pro2PromptBlock[],
): string | null {
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return "至少需要一个模板块";
  }

  for (const block of blocks) {
    if (!block.id?.trim()) return "模板块缺少 id";
    if (!block.label?.trim()) return "模板块缺少 label";
    if (!block.source) return `模板块「${block.id}」缺少 source`;
    const jsonErr = validateJsonSnippetsInBlock(block);
    if (jsonErr) return jsonErr;
  }

  return null;
}
