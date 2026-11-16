import {
  buildAplusDetailPageSystemPrompt,
  isAplusBlankPlateModule,
} from "@/lib/ecom/detail-page-aplus/aplus-prompt-system";
import { AI_DETAIL_PAGE_MODULE_CATALOG } from "@/lib/ecom/detail-page-aplus/aplus-module-catalog";
import {
  DETAIL_PAGE_SUITE_FENCE,
  DETAIL_PAGE_SUITE_SCHEMA_VERSION,
  type DetailPageSuiteSettings,
} from "@/lib/ecom/detail-page-suite/types";
import { DETAIL_PAGE_SUITE_SIZE_CHART_DATA_LABEL } from "@/lib/ecom/detail-page-suite/size-chart-constants";
import { DETAIL_PAGE_SUITE_SPEC_CHART_DATA_LABEL } from "@/lib/ecom/detail-page-suite/spec-table-constants";

export const APLUS_PROMPT_PLANNER_BODY_MAX = 32_000;

const PLATFORM_JSON_FOOTER = `
--- 平台强制输出规范（不可违反）---
1. 必须只输出一个 Markdown 围栏，围栏名为 ${DETAIL_PAGE_SUITE_FENCE}，内为 JSON，不要解释。
2. JSON 形状：
{
  "schemaVersion": "${DETAIL_PAGE_SUITE_SCHEMA_VERSION}",
  "module_id": "当前模块 id",
  "items": [
    { "item_key": "短英文key", "item_label": "必须与 user 消息 selected_item_list 原文完全一致", "positive_prompt": "摄影/场景润色正文，8字以上" }
  ]
}
3. items 条数必须等于 user 消息中的 N；item_label 不得使用列表外的子维度。
4. 子维度为「${DETAIL_PAGE_SUITE_SIZE_CHART_DATA_LABEL}」「${DETAIL_PAGE_SUITE_SPEC_CHART_DATA_LABEL}」或同类尺码/参数总表：由系统程序化出图，勿在 items 中输出（若本批无其它 LLM 子维度则不应调用写 Prompt）。
5. 禁止编造未提供的规格参数；禁止水印、乱码、低清晰度。`;

export function buildAplusModuleCatalogContextForLlm(): string {
  const lines = AI_DETAIL_PAGE_MODULE_CATALOG.map(
    (m) =>
      `- ${m.module_id} ${m.module_name}（max ${m.max_num}）：${m.candidate_pool.join(" | ")}`,
  );
  return ["【16 模块 catalog 参考】", ...lines].join("\n");
}

export const APLUS_BATCH_PROMPT_SCHEMA_VERSION = "detail-page-aplus-prompt-batch/v1";

const BATCH_PLATFORM_JSON_FOOTER = `
--- 平台强制输出规范（不可违反）---
1. 必须只输出一个 Markdown 围栏，围栏名为 ${DETAIL_PAGE_SUITE_FENCE}，内为 JSON，不要解释。
2. JSON 形状（**一次返回所有模块**）：
{
  "schemaVersion": "${APLUS_BATCH_PROMPT_SCHEMA_VERSION}",
  "modules": [
    {
      "module_id": "须与 user JSON 中 modules[].module_id 完全一致",
      "items": [
        { "item_key": "短英文key", "item_label": "必须与对应模块 selected_item_list 原文完全一致", "positive_prompt": "摄影/场景润色正文，8字以上" }
      ]
    }
  ]
}
3. modules 数组须覆盖 user 中列出的每一个 module_id，且不得多出未列出的模块。
4. 每个 module 的 items 条数必须等于该模块的 N；item_label 不得使用 selected_item_list 外的子维度。
5. 子维度为「${DETAIL_PAGE_SUITE_SIZE_CHART_DATA_LABEL}」「${DETAIL_PAGE_SUITE_SPEC_CHART_DATA_LABEL}」或同类尺码/参数总表：若未出现在 user 列表中则不要输出。
6. 禁止编造未提供的规格参数；禁止水印、乱码、低清晰度。`;

/** A+ 批量写 Prompt · 单次 LLM 调用 */
export function buildAplusBatchPromptPlannerSystem(opts: {
  settings: DetailPageSuiteSettings | undefined;
  lang: string;
}): string {
  const planner = opts.settings?.aplusPromptPlanner;
  const mode = planner?.mode ?? "default";
  const customBody = planner?.customSystemBody?.trim() ?? "";
  const langLine =
    opts.lang.includes("英") || opts.lang.toLowerCase().startsWith("en")
      ? "输出提示词使用英文。"
      : "输出提示词使用中文。";
  const defaultCore = `你的任务：根据 user 消息中的【本次需一次生成的模块列表】，**在一次输出中**为列表内每个模块生成生图正向提示词。
硬性规则：
1. 每个模块只允许使用该模块 selected_item_list 里的项目，严禁自行创造列表以外的构图主题；每一条对应列表中的一项。
2. 七维与卖点仅用于全片影调、色调、风格一致；不得编造未提供的规格参数。
3. 模块若为留白底板类（售后/赠品/使用建议等），user 通常不会列出——若列出则按留白规则：纯色干净背景、无产品实物无人物、画面内无文字。
4. 禁止水印、乱码、畸形、低清晰度、过度曝光。
5. ${langLine}`;
  if (mode === "custom" && customBody.length >= 8) {
    return `${customBody.trim()}\n${BATCH_PLATFORM_JSON_FOOTER}`;
  }
  return `${defaultCore}\n${BATCH_PLATFORM_JSON_FOOTER}`;
}

export function buildAplusPromptPlannerSystem(opts: {
  settings: DetailPageSuiteSettings | undefined;
  moduleName: string;
  moduleId: string;
  blankPlate: boolean;
  lang: string;
}): string {
  const planner = opts.settings?.aplusPromptPlanner;
  const mode = planner?.mode ?? "default";
  const customBody = planner?.customSystemBody?.trim() ?? "";

  const defaultCore = buildAplusDetailPageSystemPrompt({
    moduleName: opts.moduleName,
    blankPlate: opts.blankPlate || isAplusBlankPlateModule(opts.moduleId),
    lang: opts.lang,
  });

  if (mode === "custom" && customBody.length >= 8) {
    return `${customBody.trim()}\n${PLATFORM_JSON_FOOTER}`;
  }
  return `${defaultCore}\n${PLATFORM_JSON_FOOTER}`;
}
