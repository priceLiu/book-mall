import {
  OUTFIT_V1_LLM_JSON_PREFIX,
  OUTFIT_V1_TEMPLATE_ID,
} from "@/lib/ecom/video-workflow/templates/outfit-v1/constants";
import {
  OUTFIT_SPLIT_UNRECOGNIZED,
} from "@/lib/ecom/ecom-outfit-video-split-enrich-validate";

/** 与 media-decompose 围栏模式对齐 · 穿搭拆镜 enrich 专用 */
export const OUTFIT_SPLIT_FENCE = "ecom-outfit-split";

export const OUTFIT_V1_DEFAULT_SPLIT_MODEL = "qwen3.8-max";

/** §十 · 分镜解析 System Prompt（定稿） */
export const OUTFIT_SPLIT_V10_SYSTEM_PROMPT = `# 任务：电商穿搭短视频分镜结构化解析
你是视频分镜解析助手，依据视频分段时间戳与对应关键帧截图，输出标准化 JSON 分镜数组。

## 输入
1. 每段分镜：镜号、开始时间、结束时间、时长；
2. 当前镜头对应的关键帧截图。

## 输出字段严格定义
每一条分镜对象字段固定（JSON 内使用 camelCase）：
{
    "sceneId": "字符串镜号，s1、s2、s3",
    "cameraMove": "运镜完整中文描述，识别不到写：${OUTFIT_SPLIT_UNRECOGNIZED.camera}",
    "characterAction": "模特动作描述，聚焦服装展示，完整通顺句子，识别不到写：${OUTFIT_SPLIT_UNRECOGNIZED.action}",
    "lightingSetup": "光影完整中文描述，光源、色温、光线软硬；识别不到写：${OUTFIT_SPLIT_UNRECOGNIZED.lighting}",
    "sceneBackground": "场景完整中文描述，空间、物体、色调；识别不到写：${OUTFIT_SPLIT_UNRECOGNIZED.scene}",
    "parseIncomplete": false
}

## 强制硬性规则
1. 所有文本字段必须输出**完整通顺句子，严禁半截短语、截断、不完整结尾**。画面信息不足，直接填写「无法识别xxx」，禁止输出残缺文字。
2. 只输出纯 JSON（围栏内），不要 markdown 表格，不要解释、不要额外说明文字。
3. 只描述截图可见内容，不脑补虚构画面；优先记录衣服版型、裙摆、腰带等穿搭相关信息。
4. parseIncomplete 默认 false；只有画面模糊严重、完全无法提取有效信息时，设置为 true。
5. cameraMove、characterAction 仅用于 UI 展示归档，不需要适配 AI 绘图提示词格式。

## 业务提醒
lightingSetup、sceneBackground 后续会被前端预填充到生成提示词输入框供用户确认修改，所以输出语句通顺可读即可，不要堆砌杂乱关键词。`;

export const OUTFIT_SPLIT_JSON_DELIVERY_FOOTER = `
---
【交付格式 · 强制 · 最高优先级】
1. 回复**整段**仅为唯一围栏 \`\`\`${OUTFIT_SPLIT_FENCE}\`，内含**完整合法 JSON**（无注释、无尾逗号）。
2. 根对象含 **action**（固定 \`scene_split_enrich_complete\`）、**templateId**（固定 \`${OUTFIT_V1_TEMPLATE_ID}\`）、**scenes** 数组。
3. **禁止** Markdown 分镜表、列表、前言或闲聊；所有字段必须写在 JSON 内。
4. 切点与时长由服务端 FFmpeg 物理切镜决定；你**只标注**各镜，**禁止**增删改 sceneId 或时间轴。
5. 围栏语言标记必须是 \`${OUTFIT_SPLIT_FENCE}\`，**禁止** \`json\` / \`media-decompose\` 等代替。`.trim();

const OUTFIT_SPLIT_JSON_CONTRACT = `
## 【最高优先级】机器可读交付 · 仅 \`\`\`${OUTFIT_SPLIT_FENCE} JSON

**系统只解析 \`\`\`${OUTFIT_SPLIT_FENCE} 围栏内的 JSON。** 禁止 Markdown 表格、列表或前言。

### 必须

1. 回复**整段**仅为唯一围栏 \`\`\`${OUTFIT_SPLIT_FENCE}\`；
2. 根对象含 **action**（固定 \`scene_split_enrich_complete\`）、**templateId**（固定 \`${OUTFIT_V1_TEMPLATE_ID}\`）、**scenes** 数组；
3. **scenes** 每项字段见 System 定义；同时兼容 snake_case 别名 camera_desc/action_desc/light_desc/scene_desc/parse_incomplete；
4. 严格按 user 消息中的物理切镜时间轴：每 sceneId 一条，禁止增删镜。

### 禁止

- 口播/TTS/卖点；
- 虚构 FFmpeg 未给出的 sceneId 或时长；
- 半截短语、截断句子。`.trim();

/** System · §十定稿 + 平台围栏契约 */
export function buildOutfitSplitSystemPrompt(): string {
  return `${OUTFIT_V1_LLM_JSON_PREFIX}

${OUTFIT_SPLIT_V10_SYSTEM_PROMPT}

${OUTFIT_SPLIT_JSON_CONTRACT}

---

## 运行时上下文

- 工作流：**穿搭视频**（outfit-v1）· FFmpeg 物理切镜后的 **逐镜视觉 enrich**
- User 消息含 **每镜关键帧截图** + 时间轴；请对照截图标注对应镜号字段
- 逐镜生成 Prompt 由用户在前端编辑；运镜/动作字段不参与生成 Prompt 拼接`;
}

/** UI / 用户编辑 · §十纯中文（不含英文 JSON 前缀） */
export function buildOutfitSplitSystemPromptDisplay(): string {
  return `${OUTFIT_SPLIT_V10_SYSTEM_PROMPT}

${OUTFIT_SPLIT_JSON_CONTRACT}

---

## 运行时上下文

- 工作流：**穿搭视频**（outfit-v1）· FFmpeg 物理切镜后的 **逐镜视觉 enrich**
- User 消息含 **每镜关键帧截图** + 时间轴；请对照截图标注对应镜号字段
- 逐镜生成 Prompt 由用户在前端编辑；运镜/动作字段不参与生成 Prompt 拼接`;
}

/** 实际调用：用户自定义 System + 平台英文前缀（若尚未包含） */
export function resolveOutfitSplitSystemPromptForRun(custom?: string | null): string {
  const trimmed = custom?.trim();
  if (!trimmed) return buildOutfitSplitSystemPrompt();
  if (trimmed.includes("You must only return a complete standard JSON object")) {
    return trimmed;
  }
  return `${OUTFIT_V1_LLM_JSON_PREFIX}\n\n${trimmed}`;
}

/** 实际调用：用户自定义 User 正文（交付格式去重追加） */
export function resolveOutfitSplitUserPromptForRun(custom?: string | null): string {
  const base = custom?.trim() || DEFAULT_OUTFIT_SPLIT_USER_PROMPT;
  return appendOutfitSplitJsonDeliveryFooter(base);
}

export function outfitSplitUserPromptDisplay(): string {
  return `${DEFAULT_OUTFIT_SPLIT_USER_PROMPT.trim()}\n\n${OUTFIT_SPLIT_JSON_DELIVERY_FOOTER}`;
}

/** User · §十示例风格 */
export const DEFAULT_OUTFIT_SPLIT_USER_PROMPT = `解析下面视频片段的分镜结构化信息。

**整段回复仅为 \`\`\`${OUTFIT_SPLIT_FENCE} JSON**（见 System 契约），要求：

1. **根字段**：action=scene_split_enrich_complete、templateId=${OUTFIT_V1_TEMPLATE_ID}、scenes 数组；
2. **scenes 每镜**：sceneId、cameraMove、characterAction、lightingSetup、sceneBackground、parseIncomplete；
3. 文本须**完整通顺中文句**；识别不到用「无法识别xxx」兜底，禁止半截短语；
4. **严格按下方物理切镜时间轴**：每 sceneId 一条，禁止增删镜；
5. 对照每条时间轴后附的**关键帧截图**标注，禁止 Markdown 表格/前言/闲聊。`;

export type OutfitSplitBatchSegment = {
  sceneId: string;
  startTimeSec: number;
  endTimeSec: number;
  durationSec: number;
  previewImageUrl?: string;
};

export function appendOutfitSplitJsonDeliveryFooter(userPrompt: string): string {
  const base = userPrompt.trim();
  if (!base) return OUTFIT_SPLIT_JSON_DELIVERY_FOOTER;
  if (base.includes("【交付格式 · 强制")) return base;
  return `${base}\n\n${OUTFIT_SPLIT_JSON_DELIVERY_FOOTER}`;
}

export function buildOutfitSplitBatchEnrichUserPrompt(
  segments: OutfitSplitBatchSegment[],
  baseUserPrompt: string = DEFAULT_OUTFIT_SPLIT_USER_PROMPT,
): string {
  const timeline = segments
    .map(
      (s) =>
        `片段${s.sceneId.replace(/^s/i, "")}：${s.startTimeSec}s–${s.endTimeSec}s，时长${s.durationSec}秒（sceneId=${s.sceneId}）`,
    )
    .join("\n");

  const body = `${baseUserPrompt.trim()}

## 物理切镜时间轴（FFmpeg · 不可修改）

共 ${segments.length} 段：
${timeline}

关键帧截图见本条消息后续图片（按镜号顺序）。请输出 \`${OUTFIT_SPLIT_FENCE}\` 围栏 JSON。`;

  return appendOutfitSplitJsonDeliveryFooter(body);
}

/** §十 · 单次 multimodal：时间轴文本 + 每镜 preview 图（一次 LLM 调用） */
export function buildOutfitSplitBatchEnrichUserContent(
  segments: OutfitSplitBatchSegment[],
  baseUserPrompt?: string,
): import("@/lib/canvas/providers/types").CanvasChatContentPart[] {
  const parts: import("@/lib/canvas/providers/types").CanvasChatContentPart[] = [
    {
      type: "text",
      text: buildOutfitSplitBatchEnrichUserPrompt(segments, baseUserPrompt),
    },
  ];
  for (const seg of segments) {
    if (seg.previewImageUrl?.trim()) {
      parts.push({
        type: "text",
        text: `【镜 ${seg.sceneId} · ${seg.startTimeSec}s–${seg.endTimeSec}s】关键帧截图：`,
      });
      parts.push({
        type: "image_url",
        image_url: { url: seg.previewImageUrl.trim() },
      });
    }
  }
  return parts;
}

/** 重试子集：仅失败镜 */
export function buildOutfitSplitRetryEnrichUserContent(
  segments: OutfitSplitBatchSegment[],
  baseUserPrompt?: string,
): import("@/lib/canvas/providers/types").CanvasChatContentPart[] {
  const intro = `以下 ${segments.length} 镜上次解析存在残缺或无效字段，请**重新解析**并输出完整通顺句子。仅返回这些镜号的 scenes 条目。`;
  const core = baseUserPrompt?.trim() || DEFAULT_OUTFIT_SPLIT_USER_PROMPT;
  return buildOutfitSplitBatchEnrichUserContent(segments, `${core}\n\n${intro}`);
}

export function extractOutfitSplitFenceJson(raw: string): string | null {
  const closed = raw.match(
    new RegExp(`\`\`\`${OUTFIT_SPLIT_FENCE}\\s*([\\s\\S]*?)\`\`\``, "i"),
  );
  if (closed?.[1]) return closed[1].trim();
  const open = raw.match(new RegExp(`\`\`\`${OUTFIT_SPLIT_FENCE}\\s*([\\s\\S]*)$`, "i"));
  if (open?.[1]) return open[1].trim();
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  return jsonMatch?.[0]?.trim() ?? null;
}

export type OutfitSplitEnrichPromptUi = {
  userPrompt: string;
  systemPrompt: string;
  deliveryFooter: string;
  fence: string;
  runtimeAppendix: string;
};

export function getOutfitSplitEnrichPromptUi(): OutfitSplitEnrichPromptUi {
  return {
    userPrompt: DEFAULT_OUTFIT_SPLIT_USER_PROMPT,
    systemPrompt: buildOutfitSplitSystemPrompt(),
    deliveryFooter: OUTFIT_SPLIT_JSON_DELIVERY_FOOTER,
    fence: OUTFIT_SPLIT_FENCE,
    runtimeAppendix:
      "拆解时在 User 消息末尾追加物理切镜时间轴，并附带每镜 preview 关键帧（一次调用返回全部 scenes）。",
  };
}

export function outfitSplitUserPromptPreview(maxLen = 120): string {
  const oneLine = DEFAULT_OUTFIT_SPLIT_USER_PROMPT.replace(/\s+/g, " ").trim();
  return oneLine.length > maxLen ? `${oneLine.slice(0, maxLen)}…` : oneLine;
}
