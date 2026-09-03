import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SKILL_PATH = resolve(__dirname, "../../doc/拆图拆视频/skill.md");
const TABLE_FORMAT_PATH = resolve(__dirname, "../../doc/拆图拆视频/table-format.md");

let cachedSkill: string | null = null;
let cachedTableFormat: string | null = null;

function loadSkillMd(): string {
  if (cachedSkill) return cachedSkill;
  try {
    cachedSkill = readFileSync(SKILL_PATH, "utf8");
  } catch {
    cachedSkill = "";
  }
  return cachedSkill;
}

function loadTableFormatMd(): string {
  if (cachedTableFormat) return cachedTableFormat;
  try {
    cachedTableFormat = readFileSync(TABLE_FORMAT_PATH, "utf8");
  } catch {
    cachedTableFormat = "";
  }
  return cachedTableFormat;
}

/** 每条拆解 user 消息末尾追加（服务端强制），即使用户自定义 Prompt 也须遵守 */
export const MEDIA_DECOMPOSE_JSON_DELIVERY_FOOTER = `
---
【交付格式 · 强制 · 最高优先级】
1. 回复**整段**仅为唯一围栏 \`\`\`media-decompose ，内含**完整合法 JSON**（无注释、无尾逗号）。
2. **禁止** Markdown 分镜表、列表、前言或闲聊；所有字段（含 \`voiceover\`）必须写在 JSON 内。
3. 有旁白/配音时，每镜 JSON 字段 \`voiceover\` **不可留空**（与字幕相同可重复填写）。
4. 围栏语言标记必须是 \`media-decompose\`，**禁止** \`json\` / \`seed-video\` 等代替。`.trim();

export function appendMediaDecomposeJsonDeliveryFooter(userPrompt: string): string {
  const base = userPrompt.trim();
  if (!base) return MEDIA_DECOMPOSE_JSON_DELIVERY_FOOTER;
  if (base.includes("【交付格式 · 强制")) return base;
  return `${base}\n\n${MEDIA_DECOMPOSE_JSON_DELIVERY_FOOTER}`;
}

const MEDIA_DECOMPOSE_JSON_CONTRACT = `
## 【最高优先级】机器可读交付 · 仅 \`\`\`media-decompose JSON

**系统只解析 \`\`\`media-decompose 围栏内的 JSON。** 禁止 Markdown 表格、列表或前言。

### 必须

1. 回复**整段**仅为唯一围栏 \`\`\`media-decompose（语言标记必须是 media-decompose）；
2. 围栏内为**单一合法 JSON 对象**，根字段含 **mediaType**（image | video）与 **action**（固定 decompose_complete）；
3. 视频分镜写在 **storyboardTable** 数组；每镜使用**英文字段名**（见 table-format.md）；
4. 有口播/旁白时，每镜 **voiceover** 字符串**不可留空**；
5. 只写当前 mediaType 对应分支；JSON 禁止注释与尾逗号。

### 禁止

- 禁止 Markdown 分镜表 / 列表 / 闲聊前言；
- 禁止口播只写在 Markdown 而不写 JSON \`voiceover\`；
- 禁止 \`\`\`json\`、\`\`\`seed-video\` 等围栏代替 \`\`\`media-decompose\`。

缺围栏、JSON 非法、必填字段缺失 → **失败输出**。

### 视频 JSON 示例（mediaType: video）

\`\`\`media-decompose
{
  "mediaType": "video",
  "action": "decompose_complete",
  "visualStyle": "低饱和莫兰迪带货 lookbook",
  "globalColorTone": "暖金侧光，奶油白背景",
  "cameraLanguageSummary": "镜1固定；镜2慢推；镜3横移跟拍",
  "scenePrep": { "venue": "简约室内摄影棚", "fixedProps": "展示台、绿植" },
  "storyboardTable": [
    {
      "shotNo": 1,
      "duration": "3s",
      "shotSize": "中景",
      "cameraMove": "固定机位",
      "cameraAngle": "平视",
      "composition": "三分法",
      "lightingSetup": "柔光主灯 45° 侧顺光",
      "toneContrast": "低对比自然光",
      "visualContent": "模特手持产品面向镜头",
      "characterAction": "单手举起产品",
      "expression": "自然微笑",
      "subtitle": "夏季必备",
      "voiceover": "这件真的太好穿了",
      "sfx": "环境音",
      "bgm": "轻快 BGM",
      "transition": "切",
      "editRhythm": "快节奏"
    }
  ],
  "narrativeLogic": "…",
  "beatPoints": "…",
  "replicableShootingScript": "…"
}
\`\`\`

### 图片 JSON 示例（mediaType: image）

\`\`\`media-decompose
{
  "mediaType": "image",
  "action": "decompose_complete",
  "elements": {
    "subject": "…",
    "subjectPose": "…",
    "sceneEnvironment": "…",
    "spatialPerspective": "…",
    "composition": "…",
    "equivalentFocalLength": "…",
    "shootingAngle": "…",
    "lighting": {
      "keyLight": "…",
      "fillLight": "…",
      "rimLight": "…",
      "ambientLight": "…",
      "direction": "…",
      "hardSoft": "…",
      "colorTemperature": "…"
    },
    "materialTexture": "…",
    "colorSystem": "…",
    "atmosphere": "…",
    "detailNotes": "…"
  },
  "positivePrompt": "（须体现布光+色彩体系+画面氛围）…",
  "negativePrompt": "…",
  "liveActionReplication": {
    "cameraPlacement": "…",
    "lightingSetup": "…",
    "props": "…",
    "cameraParams": "…"
  }
}
\`\`\`
`.trim();

export function buildMediaDecomposeSystemPrompt(opts: {
  mediaKind: "image" | "video";
}): string {
  const skill = loadSkillMd();
  const tableFormat = loadTableFormatMd();
  return `${MEDIA_DECOMPOSE_JSON_CONTRACT}

---

## 运行时上下文

- 当前素材类型：**${opts.mediaKind === "video" ? "视频" : "静态图片"}**
- 你必须输出 **mediaType=${opts.mediaKind}** 对应 JSON 分支，并在 \`\`\`media-decompose 围栏内交付。

---

## 结构化字段契约（table-format.md）

${tableFormat}

---

## 领域指令（skill.md）

${skill}`;
}

export const DEFAULT_VIDEO_DECOMPOSE_USER_PROMPT = `你作为资深影视分镜&镜头语言分析师，接下来我会给到一段视频素材，请做完整反推分镜拆解。

**整段回复仅为 \`\`\`media-decompose JSON**（见 System 契约），要求：

1. **JSON 根字段**：visualStyle、globalColorTone、cameraLanguageSummary、scenePrep（venue、fixedProps）、storyboardTable、narrativeLogic、beatPoints、replicableShootingScript。
2. **storyboardTable 每镜英文字段**：shotNo、duration、shotSize、cameraMove、cameraAngle、composition、lightingSetup、toneContrast、visualContent、characterAction、expression、subtitle、**voiceover**、sfx、bgm、transition、editRhythm。
3. **口播**：有旁白/配音时，每镜 **voiceover 必须填写原文**（与字幕相同时 subtitle 与 voiceover 可写同样内容）。
4. **运镜 cameraMove**：固定机位/慢推/横移跟拍/手持微晃等可执行术语；禁止空话；本镜在动时禁止填「无」。
5. **布光/影调**：lightingSetup、toneContrast 每镜必填；可见光影时禁止「无」。
6. 禁止 Markdown 表格/前言/闲聊。`;

export const DEFAULT_IMAGE_DECOMPOSE_USER_PROMPT = `你作为资深视觉画面解析师，接下来我会上传一张静态画面，请做完整反推拆解。

**整段回复仅为 \`\`\`media-decompose JSON**（见 System 契约），要求：

1. **elements** 对象：主体、姿态、场景、透视、构图、等效焦距、拍摄角度、lighting 子对象（主/辅/轮廓/环境光、方向、软硬、色温）、材质、色彩体系、氛围、细节。
2. **positivePrompt**：须体现布光 + 色彩体系 + 画面氛围，可直接用于 AI 绘图。
3. **negativePrompt**：反向负面提示词。
4. **liveActionReplication**：机位、灯光、道具、相机参数。
5. 禁止 Markdown 表格/前言/闲聊。`;

/** 拆解输出未通过 Zod/光影质量校验时的重试 user 提示 */
export function buildMediaDecomposeDecomposeRetryUserPrompt(reason: string): string {
  return appendMediaDecomposeJsonDeliveryFooter(`上次输出未通过校验：${reason}

请**仅**重输出完整 \`\`\`media-decompose 围栏（无 Markdown），并严格遵守：
1. 视频根字段须含 visualStyle、globalColorTone、cameraLanguageSummary、scenePrep；
2. storyboardTable 每镜须含 lightingSetup、toneContrast；可见光影时禁止「无」；
3. cameraMove 用可执行运镜术语，禁止空话；
4. visualContent 写画面主体与动作，光影写入专用列；
5. 有口播时 JSON 字段 voiceover 不可留空；
6. 围栏语言标记必须是 media-decompose；禁止 json；禁止尾逗号与 JSON 注释。`);
}
