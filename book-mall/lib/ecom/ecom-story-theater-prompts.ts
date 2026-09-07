/**
 * 故事剧场模式 · LLM 系统提示词（服装 / 包包 / 3C）
 * @see docs/故事版服装提示词 库.md
 * @see docs/故事版包包提示词 库.md
 * @see docs/故事版3C数码提示词 库.md
 */

import type { ProVerticalId } from "@/lib/ecom/pro-vertical/types";
import {
  STORY_THEATER_VERSION_TITLES,
  type StoryTheaterVersionKey,
} from "./story-theater-types";

export type StoryTheaterPromptContext = {
  productName: string;
  dimensions: Record<string, string | undefined>;
  sellpoints: Array<{ id: string; text: string }>;
  selectedTopicTitle: string;
  selectedStoryCore: string;
  selectedStoryType?: string;
};

const T_VERSION_RULES = (["T1", "T2", "T3", "T4", "T5"] as StoryTheaterVersionKey[])
  .map((k) => `- ${STORY_THEATER_VERSION_TITLES[k]}（id: ${k}）`)
  .join("\n");

const FASHION_CORE = `【角色】
你是服装剧情带货短视频分镜专家，专门生成 30–45 秒单人生活化轻剧情带货分镜脚本。
本模式为【剧情故事分镜模式】，区别于纯展示口播分镜；必须带有完整微型生活剧情，禁止单纯背诵卖点式口播。

【核心定义】
1. 仅限单人主角，不出现第二个人物、无任何画面内人物对白，单一场景为主。
2. 严格基于传入的 selected_story_core 作为剧情骨架。
3. 产品卖点融入剧情动作、上身效果、神态变化。
4. 叙事闭环：烦恼纠结 → 换上服装转变 → 状态改善 → 自然带货引导

【音频旁白】
无画面内对白；audio_voice 字段填画外旁白（内心独白风格）。人物靠动作表情演出。
禁止旁白独立背诵面料参数；卖点用镜头与动作展示。

【硬性规则】
- 总时长 30–45s，6–8 镜，单镜最少 2s
- 前 3–7s 先演痛点，禁止一上来直接展示服装
- T5 情绪共鸣型：同一 story_core，强化内心独白节奏与微表情，禁止改 story_core 主线

【五套固定角度】
${T_VERSION_RULES}

【字段映射】输出 panels 时使用：
- shot_desc → 写入 sceneDesc
- model_action → modelAction
- audio_voice → dialogue（画外旁白）
- emotion → toneTexture
- subtitle → subtitle（可选）
同时生成 scenePrompt / imagePrompt / videoPrompt（≥20 字）与 garmentFocus / productFocus

【输出 JSON】仅含 storyTheaterVersions（T1–T5 各一套）+ selectedStoryTopic 回传 + coverageChecklist（可选）。
禁止 Markdown 表与额外解释文字。`;

const BAGS_CORE = FASHION_CORE.replace(/服装/g, "包袋")
  .replace(/garmentFocus/g, "productFocus")
  .replace(/穿上本款服装/g, "背上/使用本款包袋")
  .replace(/穿搭/g, "搭配");

const DIGITAL_3C_CORE = FASHION_CORE.replace(/服装/g, "数码产品")
  .replace(/garmentFocus/g, "productFocus")
  .replace(/穿上本款服装/g, "使用本款数码产品")
  .replace(/穿搭/g, "使用场景");

const STORY_THEATER_JSON_SHAPE = `{
  "schemaVersion": "fashion-v4 或 pro-v1",
  "vertical": "fashion_apparel | bags | digital_3c",
  "selectedStoryTopic": { "id": "...", "title": "...", "storyCore": "...", "storyType": "..." },
  "storyTheaterVersions": {
    "T1": { "id": "T1", "title": "...", "summary": "...", "panels": [ /* 6-8 镜 */ ], "totalDurationSec": 35 },
    "T2": { ... },
    "T3": { ... },
    "T4": { ... },
    "T5": { ... }
  },
  "coverageChecklist": [ { "sellpointId": "S01", "sellpointText": "...", "layer": "core", "panelIndexes": [1,3], "covered": true } ]
}`;

function formatDimensions(dimensions: Record<string, string | undefined>): string {
  return Object.entries(dimensions)
    .filter(([, v]) => typeof v === "string" && v.trim())
    .map(([k, v]) => `${k}: ${v!.trim()}`)
    .join("\n");
}

function formatSellpoints(sellpoints: Array<{ id: string; text: string }>): string {
  return sellpoints.map((s) => `${s.id}: ${s.text}`).join("\n");
}

export function buildStoryTheaterSystemPrompt(
  vertical: ProVerticalId | "fashion_apparel",
  context: StoryTheaterPromptContext,
): string {
  const core =
    vertical === "bags"
      ? BAGS_CORE
      : vertical === "digital_3c"
        ? DIGITAL_3C_CORE
        : FASHION_CORE;

  const ctxBlock = [
    "【当前商品上下文】",
    `productName: ${context.productName}`,
    "dimensions:",
    formatDimensions(context.dimensions) || "（无）",
    "sellpoints（已定稿）:",
    formatSellpoints(context.sellpoints) || "（无）",
    `selected_topic_title: ${context.selectedTopicTitle}`,
    `selected_story_core: ${context.selectedStoryCore}`,
    context.selectedStoryType ? `story_type: ${context.selectedStoryType}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return [
    core,
    ctxBlock,
    "【JSON 结构参考】",
    STORY_THEATER_JSON_SHAPE,
    "触发消息含 story-theater-generate 时，只输出上述 JSON，不要 prose。",
  ].join("\n\n");
}

export function resolveStoryTheaterPromptPhase(lastUserTurn: string): "story_theater" | null {
  if (
    lastUserTurn.includes("fashion-step:story-theater-generate") ||
    lastUserTurn.includes("pro-step:story-theater-generate")
  ) {
    return "story_theater";
  }
  return null;
}

export function buildStoryTheaterDeliverableContextBlock(
  context: StoryTheaterPromptContext,
): string {
  return `\n\n${buildStoryTheaterSystemPrompt("fashion_apparel", context).slice(0, 2000)}`;
}
