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

const MEDIA_DECOMPOSE_JSON_CONTRACT = `
## 【强制】机器可读交付 · \`\`\`media-decompose JSON

**系统只解析 JSON，不解析 Markdown 表格结构。** 每条回复必须：

1. 先写用户可读 Markdown（与 JSON 一致）；
2. **最末尾**追加唯一围栏 \`\`\`media-decompose（语言标记必须是 media-decompose，禁止用 json/seed-video 代替）；
3. JSON 根对象必须含 **mediaType**（image 或 video）与 **action**（固定 decompose_complete）；
4. 只写当前 mediaType 对应分支字段；JSON 禁止注释。

缺围栏、JSON 非法、必填字段缺失 → 视为失败输出。

### 视频示例（mediaType: video）

\`\`\`media-decompose
{
  "mediaType": "video",
  "action": "decompose_complete",
  "storyboardTable": [
    {
      "shotNo": 1,
      "duration": "3s",
      "shotSize": "中景",
      "cameraMove": "固定",
      "cameraAngle": "平视",
      "composition": "三分法",
      "visualContent": "…",
      "characterAction": "…",
      "expression": "…",
      "subtitle": "…",
      "voiceover": "…",
      "sfx": "…",
      "bgm": "…",
      "transition": "切",
      "editRhythm": "…"
    }
  ],
  "narrativeLogic": "…",
  "beatPoints": "…",
  "replicableShootingScript": "…"
}
\`\`\`

### 图片示例（mediaType: image）

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
  "positivePrompt": "…",
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
  return `${skill}

---

## 结构化契约（table-format.md 摘要）

${tableFormat}

---

## 运行时上下文

- 当前素材类型：**${opts.mediaKind === "video" ? "视频" : "静态图片"}**
- 你必须输出 mediaType=${opts.mediaKind} 对应 JSON 分支。

${MEDIA_DECOMPOSE_JSON_CONTRACT}`;
}

export const DEFAULT_VIDEO_DECOMPOSE_USER_PROMPT = `你作为资深影视分镜&镜头语言分析师，接下来我会给到一段视频素材，对该视频做完整主体反推分镜拆解，严格按照下面要求输出：

1. 先输出标准结构化分镜表格，表格固定字段：镜号、时长、景别、运镜、镜头角度、构图方式、画面内容、人物动作、表情、字幕文案、配音台词、音效、BGM、转场、剪辑节奏；镜头术语必须专业精准，单镜头时长贴合短视频主流节奏。
2. 表格之后额外输出三块内容：整体叙事逻辑拆解、镜头卡点要点、可直接落地复刻的同款拍摄脚本。
3. 整体格式简洁，逻辑清晰，只输出可直接落地执行的内容，不要多余闲聊废话。`;

export const DEFAULT_IMAGE_DECOMPOSE_USER_PROMPT = `你作为资深视觉画面解析师，接下来我会上传一张静态画面（产品图/宣传图/氛围感图均可），对图片进行完整反推拆解，严格按以下要求输出：

1. 先拆解画面底层要素：画面主体、主体姿态、场景环境、空间透视、构图方式、镜头参数等效焦距、拍摄角度、布光方案（主光/辅光/轮廓光/环境光，光源方向、软硬、色温）、材质质感、色彩体系、画面氛围、画面细节瑕疵/修饰点。
2. 基于拆解内容生成两套提示词：正向生成提示词（可直接投喂AI绘图）、反向负面提示词；同时附带实拍复刻方案：机位摆放、灯光布置、道具搭配、相机参数参考。
3. 格式条理清晰，全部内容直接落地可用，不要多余闲聊废话。`;
