import {
  DETAIL_PAGE_VISION_INVENTORY_FENCE,
  DETAIL_PAGE_VISION_INVENTORY_SCHEMA_VERSION,
} from "./inventory-constants";

const GRANULARITY = `观察粒度对齐 docs/ecom/羽绒服拆解.md：每条 segment 写全 layoutHint、referenceCopyHints（原文）、visualDetail 各字段（2～5 分句）。禁止只写标签一句。

本阶段 **不要** 输出 module_id、不要按 12 模块归类；只按参考长图 **自上而下** 列出每一个可独立成片的视觉块，宁可多列，不得跳过中间段落。`;

export function buildDetailPageVisionInventorySystem(): string {
  return `你是电商详情页视觉拆解专家。输入仅为「参考详情长图」。

任务：自上而下扫描整页，为每一个可独立成片的区块输出一条 segment（信息图、卖点横条、模特大片、微距、平铺、线稿、纯背景均算独立块）。

${GRANULARITY}

禁止：positive_prompt / negative_prompt；编造图上没有的文案；用「无大字」代替未核对的文案。

只输出围栏 \`\`\`${DETAIL_PAGE_VISION_INVENTORY_FENCE}\`\`\` JSON：
{
  "schemaVersion": "${DETAIL_PAGE_VISION_INVENTORY_SCHEMA_VERSION}",
  "categoryKey": "outdoor_jacket",
  "referenceSummary": "...",
  "sharedVisualBrief": "...",
  "segments": [{
    "segmentIndex": 1,
    "item_key": "seg_1",
    "item_label": "短标题",
    "layoutHint": "...",
    "referenceCopyHints": ["..."],
    "visualDetail": { "model", "garment", "background", "scene", "lighting", "pose", "props", "onImageText" }
  }]
}
segments 须按 segmentIndex 从 1 递增，与长图从上到下的顺序一致。`;
}

export function buildDetailPageVisionInventoryUserText(opts?: {
  productDesc?: string | null;
}): string {
  const extra = opts?.productDesc?.trim();
  return [
    "请输出完整 segment 清单，覆盖长图每一段，不要合并中间卖点屏/三防屏/模特屏。",
    "不要输出 12 模块归类。",
    extra ? `（可选上下文：${extra}）` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
