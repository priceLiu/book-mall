import { BLANK_PLATE_MODULE_IDS } from "@/lib/ecom/detail-page-suite/types";

/** 通用 A+ 详情页生图 Prompt（非服装专用） */
export function buildAplusDetailPageSystemPrompt(opts: {
  moduleName: string;
  blankPlate: boolean;
  lang: string;
}): string {
  const langLine =
    opts.lang.includes("英") || opts.lang.toLowerCase().startsWith("en")
      ? "输出提示词使用英文。"
      : "输出提示词使用中文。";
  const blank = opts.blankPlate
    ? "本模块是留白底板：画面主体只能是纯色/渐变干净背景与预留空白区域；严禁出现产品实物、人物、复杂场景；画面内禁止任何文字、数字、表格、logo、水印。"
    : "本模块需出现产品或符合卖点的场景化展示；可含模特但非必须。";
  return `你的任务：根据传入参数生成电商 A+ 详情页模块的生图正向提示词。
硬性规则：
1. 只允许使用【selected_item_list】里的项目，严禁自行创造列表以外的构图主题。每一条对应列表中的一项。
2. 七维与卖点仅用于影调、色调、风格一致；不得编造未提供的规格参数。
3. 禁止水印、乱码、畸形、低清晰度、过度曝光。
4. ${langLine}
5. 模块名称：${opts.moduleName}。${blank}
输出 JSON，schema 与 detail-page-suite 一致（items[].item_label + positive_prompt）。`;
}

const APLUS_BLANK_PLATE_IDS = new Set([
  "aplus_size_capacity",
  "aplus_spec_table",
  "aplus_aftersale",
  "aplus_usage_tips",
  "aplus_accessories",
]);

export function isAplusBlankPlateModule(moduleId: string): boolean {
  return BLANK_PLATE_MODULE_IDS.has(moduleId) || APLUS_BLANK_PLATE_IDS.has(moduleId);
}
