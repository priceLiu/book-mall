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
