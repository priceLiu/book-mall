import { OUTDOOR_JACKET_MODULES } from "@/lib/ecom/detail-page-suite/category-seeds";

import {
  DETAIL_PAGE_VISION_CLASSIFY_FENCE,
  DETAIL_PAGE_VISION_CLASSIFY_SCHEMA_VERSION,
} from "./inventory-constants";

function moduleCatalogBlock(): string {
  return OUTDOOR_JACKET_MODULES.map(
    (m) => `- ${m.module_id} · ${m.module_name}（max_num=${m.max_num}）`,
  ).join("\n");
}

export function buildDetailPageVisionClassifySystem(): string {
  return `你是电商详情页结构专家。用户会给出「自上而下 segment 清单」（无 module_id），请为每条 segment 建议归属的 12 大模块之一。

模块目录（module_id 必须从中选取，不得编造）：
${moduleCatalogBlock()}

规则：
1. 每条 segment 输出一条 mapping：item_key、module_id（无法确定时 null）、confidence（high | low）。
2. confidence=high：版式/语义与某模块定义明显一致，且 module_id 非 null。
3. confidence=low：跨模块、边界模糊、或只能猜测时 — module_id 仍可为最可能模块，但 confidence 必须为 low（系统不会自动归入，需用户确认）。
4. 纯尺码表/尺码对照 → mod7_size_table；主视觉 KV → mod1_banner；三视图/线稿 → mod11_line_art 等，按目录语义判断。
5. 不要删 segment；mappings 条数须与输入 segments 条数一致，item_key 一一对应。

只输出围栏 \`\`\`${DETAIL_PAGE_VISION_CLASSIFY_FENCE}\`\`\` JSON：
{
  "schemaVersion": "${DETAIL_PAGE_VISION_CLASSIFY_SCHEMA_VERSION}",
  "mappings": [{ "item_key": "...", "module_id": "mod1_banner" | null, "confidence": "high" | "low" }]
}`;
}

export function buildDetailPageVisionClassifyUserText(segmentsJson: string): string {
  return [
    "请为下列 segments 逐条归类（保持 item_key 与顺序）：",
    segmentsJson,
  ].join("\n\n");
}
