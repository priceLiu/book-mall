import { OUTDOOR_JACKET_MODULES } from "@/lib/ecom/detail-page-suite/category-seeds";

import {
  DETAIL_PAGE_VISION_DECOMPOSE_FENCE,
  DETAIL_PAGE_VISION_DECOMPOSE_SCHEMA_VERSION,
} from "./constants";
import { DETAIL_PAGE_VISION_MODULE_IDS } from "./schemas";

const GLOBAL_STYLE_NOTE = `参考图为电商服装详情长图：商业摄影、竖版移动端详情、写实。本阶段只做「参考页上有什么」的结构化记录；粒度对齐内部样例《羽绒服拆解》（逐张、信息密度高），但输出仍是拆解 JSON，不是正向/负向生图 Prompt。`;

/** 与 docs/ecom/羽绒服拆解.md 同类的观察深度说明（拆解字段版） */
const VISUAL_DETAIL_GRANULARITY = `visualDetail 各字段须为 **高密度中文观察**（每条建议 2～5 个分句，逗号或分号分隔；禁止仅写「1 人男性青年站立」等标签一句）：

- model：人数；每人可见特征（年龄段、性别、人种/肤色倾向、发型、帽/镜/妆面、表情）；全身/半身/局部；构图位置（居中/偏左/偏右）；多人时主次与间距
- garment：品类与主辅色、穿法（拉链/叠穿/敞开）、可见结构（帽、口袋、袖口、下摆）；细节特写须写 **聚焦部位**（如领口拉链、袖标、魔术贴袖口）
- background：具体环境元素（高原残雪、针叶林、纯色棚拍背景色、线稿白底等），近景/远景层次
- scene：拍摄场景类型 + 人物动作语境（户外徒步、棚拍版型展示、产品静物平铺、科普剖面示意等）
- lighting：主光方向与软硬、色温（清冷/暖调/均匀棚拍柔光）、背景景深倾向
- pose：体态与四肢/手部动作（拉拉链、握杖、行走、插袋等），与服装展示的关系
- props：背包、登山杖、手套等及持握方式
- onImageText：与 referenceCopyHints 一致；有字必填

layoutHint 须含：竖版长图块内景别（首屏 banner / 半身 / 全身 / 微距特写 / 平铺 / 线稿示意）、构图（居中、留白区供后期叠字、左右分栏拼图等）。

无模特画面（平铺、线稿、纯背景、剖面示意）：model 写「无人物」；garment/scene/background 仍按样例密度描述产品或图示内容。`;

function moduleTableForPrompt(): string {
  return OUTDOOR_JACKET_MODULES.map((m) => `${m.module_id} ${m.module_name}`).join("\n");
}

export function buildDetailPageVisionDecomposeSystem(): string {
  return `你是电商详情页视觉拆解专家。用户仅提供「参考详情长图」。

任务：自上而下扫描长图，把每一个可独立成片的画面归类到固定 12 模块；每个画面一条 item，条数以参考页为准。

${GLOBAL_STYLE_NOTE}

12 模块（输出 modules 长度 12，module_id 与顺序必须与下表一致）：
${moduleTableForPrompt()}

${VISUAL_DETAIL_GRANULARITY}

每条 item 还须包含：
- item_key / item_label：短标题（可含模块用途，如「首屏 banner」「拉链胸袋微距」）
- referenceCopyHints：字符串数组，逐条写出参考图上 **可读文案原文**（主标题、副标题、卖点条、数字与指标名、角标等）；按阅读顺序；看不清用「…」

拆解阶段禁止：输出 positive_prompt / negative_prompt；编造图上没有的文案；用「无大字」代替未逐条核对的文案。

mod7_size_table：识别到尺码区块则 detected=true 并写 sizeChartHint；items 可为 []。
detected=false 时 items 必须为 []。
coverageNote：说明该模块在参考页上的覆盖范围。
sharedVisualBrief：整套参考详情共享的摄影风格、色调节奏、典型景别（不写品牌名）。

只输出围栏 \`\`\`${DETAIL_PAGE_VISION_DECOMPOSE_FENCE}\`\`\` 内 JSON：
{
  "schemaVersion": "${DETAIL_PAGE_VISION_DECOMPOSE_SCHEMA_VERSION}",
  "categoryKey": "outdoor_jacket",
  "referenceSummary": "...",
  "sharedVisualBrief": "...",
  "modules": [{
    "module_id", "detected", "coverageNote", "sizeChartHint",
    "items": [{
      "item_key", "item_label", "layoutHint", "referenceCopyHints",
      "visualDetail": { "model", "garment", "background", "scene", "lighting", "pose", "props", "onImageText" }
    }]
  }]
}
module_id 顺序：${DETAIL_PAGE_VISION_MODULE_IDS.join(", ")}`;
}

export function buildDetailPageVisionDecomposeUserText(opts?: {
  productDesc?: string | null;
}): string {
  const extra = opts?.productDesc?.trim();
  return [
    "请仅根据参考详情长图做视觉拆解并归类到 12 模块。",
    "visualDetail 观察深度须对齐《羽绒服拆解》逐张描述：模特/服装/场景/光线/姿态写全，细节特写写清聚焦部位。",
    "referenceCopyHints 写出图上可见文案原文；onImageText 与之对应。",
    "不要假设用户已提供自家产品图或模特图。",
    extra ? `（可选上下文，非参考页内容：商品简述 ${extra}）` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
