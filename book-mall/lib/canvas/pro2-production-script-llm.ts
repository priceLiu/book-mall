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
import { listPro2FullPackPatchIssues, listPro2SemanticPatchIssues } from "./data/pro2-production-script-schema";

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
  if (section === "outline" && patchRaw.step !== "full_pack") {
    return {
      ok: false,
      error: `Hub 制作包须 step=full_pack（含 scenes/characters/shots/handoff），当前 step=${patchRaw.step}`,
    };
  }
  if (section === "outline" && patchRaw.step === "full_pack") {
    const fullPackIssues = [
      ...listPro2FullPackPatchIssues(patchRaw.patch),
      ...listPro2SemanticPatchIssues(patchRaw.patch, "full_pack"),
    ];
    if (fullPackIssues.length) {
      return {
        ok: false,
        error: fullPackIssues.slice(0, 4).join("；"),
      };
    }
  }
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
    "1. **只输出** ```pro2-production-script``` JSON 围栏；禁止 Markdown/GFM/说明文字",
    "2. schemaVersion: 2 · tier: pro · step 与当前任务一致",
    "3. Hub 大纲段须 step=full_pack，且 patch 须含 visualStyle/coreConflict/scenes/characters/props/shots/handoff",
    "4. characters[].traits ≥3 项；禁止「标志性动作」；imagePrompt 须含构图规范与 [视觉风格：…]",
    "5. shots[].dialogue 非 — 时须 角色名（情绪）：\"台词\"",
    "6. 禁止尾逗号与 // 注释",
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
