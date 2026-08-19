/**
 * Pro2 制作包 · Gateway LLM 结构化输出（Zod 校验 + 自动重试）
 */
import type { CanvasTaskStoryScope } from "./canvas-story-scope";
import {
  describePro2ProductionScriptParseFailure,
  extractPro2ProductionScriptPatch,
  extractPro2ProductionScriptPatchRaw,
  pro2PatchStepMatchesSection,
} from "./pro2-production-script-structured";
import { findPro2UnwantedEnglishFields } from "./pro2-chinese-prompt-normalize";
import { STORY_PRO2_JSON_FIELD_RULES, STORY_PRO2_PACK_LANGUAGE_RULES } from "./data/pro2-production-pack-standard";
import type { Pro2ProductionScriptPatch } from "./data/pro2-production-script-schema";

const PRO2_HUB_SECTIONS = new Set([
  "outline",
  "character",
  "scene",
  "storyboard",
  "shot_prompts",
]);

export function isPro2StructuredLlmScope(
  storyScope?: CanvasTaskStoryScope | null,
): boolean {
  const section = storyScope?.llmSection;
  return Boolean(section && PRO2_HUB_SECTIONS.has(section));
}

export function mergePro2StructuredLlmParams(
  params: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...params };
  delete next.response_format;
  return next;
}

export type Pro2StructuredLlmValidation = {
  ok: boolean;
  patch?: Pro2ProductionScriptPatch;
  error?: string;
};

export function validatePro2ProductionScriptLlmOutput(
  text: string,
  storyScope?: CanvasTaskStoryScope | null,
): Pro2StructuredLlmValidation {
  const trimmed = text.trim();
  if (!trimmed) {
    return { ok: false, error: "模型返回空内容" };
  }
  const patchRaw = extractPro2ProductionScriptPatchRaw(trimmed);
  if (!patchRaw) {
    const detail =
      describePro2ProductionScriptParseFailure(trimmed) ??
      "无法解析 pro2-production-script JSON";
    return {
      ok: false,
      error: detail,
    };
  }
  const section = storyScope?.llmSection;
  if (
    section &&
    PRO2_HUB_SECTIONS.has(section) &&
    !pro2PatchStepMatchesSection(
      patchRaw.step,
      section as "outline" | "character" | "scene" | "storyboard" | "shot_prompts",
    )
  ) {
    return {
      ok: false,
      error: `JSON step=${patchRaw.step} 与当前段 llmSection=${section} 不匹配`,
    };
  }
  const englishIssues = findPro2UnwantedEnglishFields(patchRaw);
  if (englishIssues.length) {
    return {
      ok: false,
      error: englishIssues.slice(0, 4).join("；"),
    };
  }
  const patch = extractPro2ProductionScriptPatch(trimmed);
  if (!patch) {
    return { ok: false, error: "无法解析 pro2-production-script JSON" };
  }
  return { ok: true, patch };
}

export function buildPro2StructuredRetryUserMessage(error: string): string {
  return [
    "【系统 · 结构化 JSON 重试】",
    "上一回复未通过 pro2-production-script 严格校验，请重新输出。",
    "",
    `校验错误：${error.slice(0, 600)}`,
    "",
    STORY_PRO2_JSON_FIELD_RULES,
    "",
    STORY_PRO2_PACK_LANGUAGE_RULES,
    "",
    "要求：",
    "1. 输出合法 JSON（schemaVersion: 1 · tier: pro · step · patch）",
    "2. step 须与当前任务段一致；full_pack 须含 visualStyle/coreConflict/scenes/characters/shots/handoff",
    "3. 字段名须与契约完全一致，禁止 identity/aiImagePrompt/environment/keywords 等 alias",
    "4. scenes[].negativePrompt 须中文顿号列表，禁止 [Negative: …] 英文",
    "5. 可包在 ```pro2-production-script 围栏内；禁止尾逗号与 // 注释",
  ].join("\n");
}

export function ensurePro2ProductionScriptFence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  if (/```pro2-production-script/i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("{") && trimmed.includes('"schemaVersion"')) {
    return `${trimmed}\n\n\`\`\`pro2-production-script\n${trimmed}\n\`\`\``;
  }
  return trimmed;
}
