/**
 * Pro2 制作包 · Gateway LLM 结构化输出（response_format + Zod 校验 + 自动重试）
 */
import type { CanvasTaskStoryScope } from "./canvas-story-scope";
import {
  extractPro2ProductionScriptPatch,
  pro2PatchStepMatchesSection,
} from "./pro2-production-script-structured";
import type { Pro2ProductionScriptPatch } from "./data/pro2-production-script-schema";

const PRO2_HUB_SECTIONS = new Set([
  "outline",
  "character",
  "scene",
  "storyboard",
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
  const existing = params.response_format;
  if (
    existing &&
    typeof existing === "object" &&
    (existing as { type?: string }).type === "json_object"
  ) {
    return params;
  }
  return {
    ...params,
    response_format: { type: "json_object" },
  };
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
  const patch = extractPro2ProductionScriptPatch(trimmed);
  if (!patch) {
    return {
      ok: false,
      error:
        "无法解析 pro2-production-script JSON（缺围栏、JSON 语法错误或 Zod 校验失败）",
    };
  }
  const section = storyScope?.llmSection;
  if (
    section &&
    PRO2_HUB_SECTIONS.has(section) &&
    !pro2PatchStepMatchesSection(
      patch.step,
      section as "outline" | "character" | "scene" | "storyboard",
    )
  ) {
    return {
      ok: false,
      error: `JSON step=${patch.step} 与当前段 llmSection=${section} 不匹配`,
    };
  }
  return { ok: true, patch };
}

export function buildPro2StructuredRetryUserMessage(error: string): string {
  return [
    "【系统 · 结构化 JSON 重试】",
    "上一回复未通过 pro2-production-script 校验，请重新输出。",
    "",
    `校验错误：${error.slice(0, 400)}`,
    "",
    "要求：",
    "1. 输出合法 JSON（schemaVersion: 1 · tier · step · patch）",
    "2. step 须与当前任务段一致",
    "3. 可包在 ```pro2-production-script 围栏内，或直接输出 JSON 对象",
    "4. 禁止尾逗号与 // 注释",
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
