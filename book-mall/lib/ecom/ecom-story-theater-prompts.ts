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
  sellpoints: Array<{ id: string; text: string; layer?: string }>;
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
1. 以单人主角、单一场景为主；可按剧情需要写画外旁白或主角口播/对白，不强制只用一种。
2. 严格基于传入的 selected_story_core 作为剧情骨架。
3. 产品卖点融入剧情动作、上身效果、神态变化。
4. 叙事闭环：烦恼纠结 → 换上服装转变 → 状态改善 → 自然带货引导

【卖点绑定 · 必填】
上下文 sellpoints（已定稿）中的 id（如 S01、S02…）是唯一合法卖点 ID。
- 每镜 panels 必填 sellpointIds：字符串数组，引用上述 id，每镜至少 1 条；禁止空数组或「—」。
- 全片须覆盖全部 core + visual 卖点（aux 可进运营包）；同一卖点可出现在多镜。
- 必须输出 coverageChecklist：逐条列出每个 core/visual 卖点的 sellpointId、sellpointText、layer、panelIndexes、covered:true。
- garmentFocus / productFocus 须与当镜 sellpointIds 语义一致。

【台词 / 配音 · 基于卖点设计】
每镜 dialogue（或 audio_voice）须根据当镜 sellpointIds 对应的卖点文案来设计，可写画外旁白、主角口播或内心独白，按剧情选用。
- layer=core 的卖点：优先在本镜 dialogue 中自然带出（口语化、不背参数表）。
- layer=visual 的卖点：dialogue 可轻点或留空，但须在 sellpointIds 中绑定并在镜头/动作中展示。
- 6–8 镜中至少 4 镜应有非空 dialogue；仅纯动作特写镜可留空。
用户可在中栏分镜表自行修改；禁止全片 dialogue 留空或 sellpointIds 与上方卖点表脱节。

【硬性规则】
- 总时长 30–45s，6–8 镜，单镜最少 2s
- 前 3–7s 先演痛点，禁止一上来直接展示服装
- T5 情绪共鸣型：同一 story_core，可强化旁白/口播节奏与微表情，禁止改 story_core 主线

【五套固定角度】
${T_VERSION_RULES}

【字段映射】输出 panels 时使用：
- index, shotScale, durationSec, cameraMove
- shot_desc → sceneDesc
- model_action → modelAction
- audio_voice / dialogue → dialogue（口播或旁白，同义；须呼应 sellpointIds）
- emotion → toneTexture
- subtitle → subtitle（可选）
- sellpointIds → 必填，引用已定稿卖点 id 数组
同时生成 scenePrompt / imagePrompt / videoPrompt（≥20 字）与 garmentFocus / productFocus

【输出 JSON】须含 storyTheaterVersions（T1–T5 各一套）+ selectedStoryTopic 回传 + coverageChecklist（必填）。
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
    "T1": {
      "id": "T1",
      "title": "...",
      "summary": "...",
      "panels": [
        {
          "index": 1,
          "shotScale": "中全景",
          "durationSec": 4,
          "cameraMove": "固定",
          "sceneDesc": "...",
          "scenePrompt": "...",
          "imagePrompt": "...",
          "videoPrompt": "...",
          "modelAction": "...",
          "garmentFocus": "...",
          "dialogue": "（基于 sellpointIds 设计的口播/旁白）",
          "toneTexture": "...",
          "sellpointIds": ["S01"]
        }
      ],
      "totalDurationSec": 35
    },
    "T2": { "...": "同上结构，6-8 镜" },
    "T3": { "...": "..." },
    "T4": { "...": "..." },
    "T5": { "...": "..." }
  },
  "coverageChecklist": [
    { "sellpointId": "S01", "sellpointText": "...", "layer": "core", "panelIndexes": [1, 3], "covered": true }
  ]
}`;

function formatDimensions(dimensions: Record<string, string | undefined>): string {
  return Object.entries(dimensions)
    .filter(([, v]) => typeof v === "string" && v.trim())
    .map(([k, v]) => `${k}: ${v!.trim()}`)
    .join("\n");
}

function formatSellpoints(
  sellpoints: Array<{ id: string; text: string; layer?: string }>,
): string {
  return sellpoints
    .map((s) => {
      const layer = s.layer?.trim() ? ` [${s.layer.trim()}]` : "";
      return `${s.id}${layer}: ${s.text}`;
    })
    .join("\n");
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
