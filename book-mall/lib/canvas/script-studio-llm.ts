/**
 * Script Studio 批次 · Gateway LLM 结构化输出（Zod 校验 + 自动重试）
 */
import type { CanvasTaskStoryScope } from "./canvas-story-scope";
import {
  parseScriptStudioBatchJson,
  SCRIPT_STUDIO_BATCH_FENCE_TAG,
  type ScriptStudioBatchJson,
} from "./data/script-studio-batch-schema";
import { SCRIPT_STUDIO_JSON_FIELD_RULES } from "./script-studio-prompts";

/** 单次 Canvas 任务内 · Script Studio 结构化 LLM 最多尝试次数（含首次） */
export const SCRIPT_STUDIO_STRUCTURED_LLM_MAX_ATTEMPTS = 5;

export function isScriptStudioStructuredLlmScope(
  storyScope?: CanvasTaskStoryScope | null,
): boolean {
  return storyScope?.mediaKind === "scriptStudioBatch";
}

export function mergeScriptStudioStructuredLlmParams(
  params: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...params };
  delete next.response_format;
  return next;
}

export type ScriptStudioStructuredLlmValidation = {
  ok: boolean;
  batch?: ScriptStudioBatchJson;
  error?: string;
};

function extractJsonFromFence(text: string): unknown | null {
  const fenceRe = new RegExp(
    `\`\`\`${SCRIPT_STUDIO_BATCH_FENCE_TAG}\\s*\\n([\\s\\S]*?)\\n\`\`\``,
    "i",
  );
  const m = text.match(fenceRe);
  if (m?.[1]) {
    try {
      return JSON.parse(m[1].trim());
    } catch {
      return null;
    }
  }
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.includes('"schemaVersion"')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return null;
    }
  }
  return null;
}

export function describeScriptStudioParseFailure(text: string): string | null {
  const raw = extractJsonFromFence(text);
  if (!raw) {
    if (/```script-studio-batch/i.test(text)) {
      return "script-studio-batch 围栏内 JSON 无法解析";
    }
    return null;
  }
  const parsed = parseScriptStudioBatchJson(raw);
  if (!parsed.ok) return parsed.error;
  return null;
}

export function validateScriptStudioBatchLlmOutput(
  text: string,
): ScriptStudioStructuredLlmValidation {
  const trimmed = text.trim();
  if (!trimmed) {
    return { ok: false, error: "模型返回空内容" };
  }
  const raw = extractJsonFromFence(trimmed);
  if (!raw) {
    const detail =
      describeScriptStudioParseFailure(trimmed) ??
      "无法解析 script-studio-batch JSON 围栏";
    return { ok: false, error: detail };
  }
  const parsed = parseScriptStudioBatchJson(raw);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error };
  }
  return { ok: true, batch: parsed.batch };
}

export function buildScriptStudioStructuredRetryUserMessage(
  error: string,
  attempt?: number,
): string {
  const attemptLine =
    attempt != null && attempt > 0
      ? `当前为第 ${attempt + 1} 次生成（至多 ${SCRIPT_STUDIO_STRUCTURED_LLM_MAX_ATTEMPTS} 次）。`
      : "";
  return [
    "【系统 · 结构化 JSON 重试】",
    "上一回复未通过 script-studio-batch 严格校验，请重新输出。",
    attemptLine,
    "",
    `校验错误：${error.slice(0, 600)}`,
    "",
    SCRIPT_STUDIO_JSON_FIELD_RULES,
    "",
    "要求：",
    "1. **只输出** ```script-studio-batch``` JSON 围栏；禁止 Markdown/GFM/说明文字",
    "2. schemaVersion: 1 · action 与任务一致（首轮 first_round_with_bibles / 续批 batch_complete）",
    "3. episodes[] 须覆盖 batch.startEpisode～endEpisode 全部集数，每集 10 模块字段齐全",
    "4. module7_storyboard 与 module8_imagePrompts 镜号一一对应，每镜 zh+en 成对",
    "5. 禁止尾逗号与 // 注释",
  ].join("\n");
}

export function ensureScriptStudioBatchFence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  if (/```script-studio-batch/i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("{") && trimmed.includes('"schemaVersion"')) {
    return `${trimmed}\n\n\`\`\`script-studio-batch\n${trimmed}\n\`\`\``;
  }
  return trimmed;
}

export function extractScriptStudioBatchFromText(
  text: string,
): ScriptStudioBatchJson | null {
  const validation = validateScriptStudioBatchLlmOutput(text);
  return validation.ok ? (validation.batch ?? null) : null;
}
