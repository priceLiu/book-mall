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
import {
  listPro2FullPackPatchIssues,
  listPro2SemanticPatchIssues,
  listShotPromptsPass2Issues,
} from "./data/pro2-production-script-schema";

const PRO2_HUB_SECTIONS = new Set([
  "outline",
  "character",
  "scene",
  "storyboard",
  "shot_prompts",
]);

/** 单次 Canvas 任务内 · Pro2 结构化 LLM 最多尝试次数（含首次） */
export const PRO2_STRUCTURED_LLM_MAX_ATTEMPTS = 5;

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
  if (section === "shot_prompts" && patchRaw.step === "shot_prompts") {
    const polishMode = storyScope?.polishMode ?? "both";
    const pass2Issues = listShotPromptsPass2Issues(
      patchRaw.patch.shots,
      polishMode,
    );
    if (pass2Issues.length) {
      return {
        ok: false,
        error: pass2Issues.slice(0, 4).join("；"),
      };
    }
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

export function buildPro2StructuredRetryUserMessage(
  error: string,
  attempt?: number,
): string {
  const attemptLine =
    attempt != null && attempt > 0
      ? `当前为第 ${attempt + 1} 次生成（至多 ${PRO2_STRUCTURED_LLM_MAX_ATTEMPTS} 次）。`
      : "";
  return [
    "【系统 · 结构化 JSON 重试】",
    "上一回复未通过 pro2-production-script 严格校验，请重新输出。",
    attemptLine,
    "",
    `校验错误：${error.slice(0, 600)}`,
    "",
    STORY_PRO2_JSON_FIELD_RULES,
    "",
    STORY_PRO2_PACK_LANGUAGE_RULES,
    "",
    "要求：",
    "1. **只输出** ```pro2-production-script``` JSON 围栏；禁止 Markdown/GFM/说明文字",
    "2. schemaVersion: 3 · tier: pro · step 与当前任务一致；meta.packProfile 为 director|industrial",
    "3. Hub 大纲段须 step=full_pack，且 patch 须含 visualStyle/coreConflict/scenes/characters/props/shots/handoff",
    "4. **creative 时长硬性**：shots 必须完整 **12–18 镜**（推荐 15），每镜 durationSec **10–15**，合计 **175–185**（推荐 180）；禁止只交 2 镜样例",
    "5. colorBlock 须为对象 { primary }，禁止字符串；dayPalette/nightPalette 同理为对象",
    "6. characters[].traits ≥3 项；禁止「标志性动作」；imagePrompt 须含构图规范与 [视觉风格：…]",
    "7. shots[].dialogue 非 — 时须 角色名（情绪）：\"台词\"",
    "8. 每镜须含 sceneId（引用 scenes[].id）；有对白角色时须 characterIds；画面出现道具时 propIds 不得空",
    "8a. **场景绑定（硬性）**：scenes[]≥2 时禁止全片同一 sceneId；每镜 lighting 首句须含该镜 scenes[].name（canonical name），且 sceneId 须随场景切换而变更",
    "9. sceneDescription 中角色/场景/道具名称须与辞典 canonical name 一致",
    "10. director 档禁止 shots[].analysis；industrial 档每镜必填 analysis",
    "11. 禁止尾逗号与 // 注释",
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
