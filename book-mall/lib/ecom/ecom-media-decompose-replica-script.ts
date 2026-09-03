import type { CanvasChatContentPart } from "@/lib/canvas/providers/types";
import type { MediaDecomposePatch } from "@/lib/ecom/ecom-media-decompose-structured";
import type { ReplicaMentionEntry } from "@/lib/ecom/ecom-media-decompose-replica-refs";
import type { SeedVideoReference, SeedVideoShot } from "@/lib/ecom/ecom-seed-video-types";
import { buildReplicaShotsFromDecompose } from "@/lib/ecom/ecom-media-decompose-replica";

const FENCE = "replica-script";
/** 解析兜底：模型仍可能输出 ```json；契约层禁止，解析层宽容 */
const SCRIPT_FENCE_PARSE_ALIASES = [FENCE, "json"] as const;

const REPLICA_SCRIPT_FENCE_CONTRACT = `
## 【强制 · 机器校验】\`\`\`${FENCE} JSON 契约

系统**只解析**回复**最末尾**唯一围栏 \`\`\`${FENCE}（语言标记必须是 ${FENCE}，**禁止**用 json / media-decompose / film-pull 代替）。

### 输出顺序
1. 可选：1–3 句中文摘要（可省略）；
2. **最后一行起**输出唯一 \`\`\`${FENCE} 围栏，内含合法 JSON（无注释、无尾逗号）。

### 根对象
| 字段 | 类型 | 规则 |
|------|------|------|
| shots | array | **至少 1 镜**；镜数须与用户提供的机械映射草稿一致 |

### 每镜 shots[]
| 字段 | 类型 | 规则 |
|------|------|------|
| index | number | 从 1 递增，与草稿镜号一致 |
| timeSlice | string | 如 \`0-3s\` |
| sceneDescription | string | 换模特/产品后的画面描述，非空 |
| videoPrompt | string | 景别/运镜/构图/布光/影调/全片色调/动作/音效/BGM/转场/剪辑；须含 @图片N；**禁止**口播原文 |
| voiceover | string | 仅口播/字幕（可空字符串）；**禁止**写入 videoPrompt |
| durationSec | number | 3–15 整数 |

### 示例（2 镜，围栏名勿改）
\`\`\`${FENCE}
{
  "shots": [
    {
      "index": 1,
      "timeSlice": "0-3s",
      "sceneDescription": "新模特 @图片1 手持 @图片2 产品面向镜头",
      "videoPrompt": "@图片1 @图片2，中景，固定机位，三分法，柔光侧顺光，低对比自然光，暖金色调，快门声，轻快 BGM，硬切",
      "voiceover": "这件针织开衫真的太好穿了",
      "durationSec": 3
    },
    {
      "index": 2,
      "timeSlice": "3-8s",
      "sceneDescription": "产品面料特写，手指划过 @图片2",
      "videoPrompt": "@图片2，特写，慢推，俯拍，居中，侧光轮廓，低饱和，摩擦音，BGM 延续，叠化",
      "voiceover": "轻薄透气，上身无负担",
      "durationSec": 5
    }
  ]
}
\`\`\`
`;

export type ReplicaScriptPatch = {
  shots: Array<{
    index: number;
    timeSlice?: string;
    sceneDescription: string;
    videoPrompt: string;
    voiceover: string;
    durationSec?: number;
    refImageLabel?: string;
  }>;
};

export function buildReplicaScriptSystemPrompt(catalog: ReplicaMentionEntry[]): string {
  const mentionLines = catalog.map((e) => `${e.token}：${e.ref.label}（${e.role === "model" ? "模特" : "产品"}）`);
  const mentionBlock = mentionLines.length ? mentionLines.join("\n") : "@图片1：模特；@图片2：产品";
  return `你是电商短视频复刻编剧。用户已从原视频/图拆解出分镜，并提供了新的模特图与产品图（可各多张）及产品说明。
你的任务：在保留原片镜头语言、节奏、景别、运镜、**布光、影调、全片色调与视觉风格**的前提下，将画面与口播中的旧模特、旧产品替换为新模特与新商品。

参考图编号（须在 videoPrompt 中按需引用）：
${mentionBlock}

${REPLICA_SCRIPT_FENCE_CONTRACT}

### 业务规则（与 JSON 一并满足）
1. videoPrompt 与 voiceover **严格分离**（见上表）；
2. 机械映射草稿的 videoPrompt 已含景别/运镜/布光/影调/音效/BGM/转场/剪辑；改写时须保留信息密度，**不得删减**光影、影调、色调与运镜描述；
3. **继承**原片场景、道具感、BGM/音效气质、转场与剪辑节奏；**只替换**模特（@图片N）、产品、与旧 SKU 绑定的动作描述；
4. cameraMove 不得弱化（慢推不可改固定，横移不可省略）；
5. sceneDescription 用中文描述换模特换产品后的画面；
6. 镜数与拆解表一致，除非原表为空则输出 1 镜。`;
}

export function buildReplicaScriptUserPrompt(opts: {
  structured: MediaDecomposePatch;
  productBrief: string;
  sellingPoints?: string;
  draftShots: SeedVideoShot[];
  mentionSummary: string;
}): string {
  const tableJson = JSON.stringify(opts.structured, null, 2);
  const draftJson = JSON.stringify(
    opts.draftShots.map((s) => ({
      index: s.index,
      timeSlice: s.timeSlice,
      sceneDescription: s.sceneDescription,
      videoPrompt: s.videoPrompt,
      voiceover: s.voiceover,
      durationSec: s.durationSec,
    })),
    null,
    2,
  );
  const sellingBlock = opts.sellingPoints?.trim()
    ? opts.sellingPoints.trim()
    : "（用户未填写卖点）";
  return [
    "## 拆解结果（原片）",
    tableJson,
    "",
    "## 机械映射草稿（待你改写替换模特/产品）",
    draftJson,
    "",
    "## 参考图编号",
    opts.mentionSummary.trim() || "（见系统说明）",
    "",
    "## 新产品说明",
    opts.productBrief.trim() || "（用户未填写，请根据产品图推断品类与展示方式）",
    "",
    "## 卖点",
    sellingBlock,
    "",
    `请按系统契约，在回复最末尾输出唯一 \`\`\`${FENCE} 围栏 JSON（禁止用 json 围栏代替）。`,
  ].join("\n");
}

export function buildReplicaScriptUserContent(opts: {
  structured: MediaDecomposePatch;
  productBrief: string;
  sellingPoints?: string;
  draftShots: SeedVideoShot[];
  mentionSummary: string;
  mentionCatalog: ReplicaMentionEntry[];
}): CanvasChatContentPart[] {
  const parts: CanvasChatContentPart[] = [
    {
      type: "text",
      text: buildReplicaScriptUserPrompt({
        structured: opts.structured,
        productBrief: opts.productBrief,
        sellingPoints: opts.sellingPoints,
        draftShots: opts.draftShots,
        mentionSummary: opts.mentionSummary,
      }),
    },
  ];

  for (const entry of opts.mentionCatalog.slice(0, 8)) {
    const url = entry.ref.ossUrl?.trim();
    if (!url) continue;
    parts.push({ type: "image_url", image_url: { url } });
    parts.push({
      type: "text",
      text: `${entry.token}（${entry.role === "model" ? "模特" : "产品"}：${entry.ref.label ?? ""}）`,
    });
  }

  return parts;
}

export function buildReplicaScriptRetryUserPrompt(expectedShotCount: number): string {
  return `上次输出未通过机器校验：缺少可解析的 \`\`\`${FENCE} 围栏，或使用了 json 等其他围栏名，或 shots 为空/字段不完整。

请**仅**重输出完整 \`\`\`${FENCE} 围栏（可省略 Markdown 前言），并严格遵守：
1. 围栏语言标记必须是 ${FENCE}，**禁止** json / media-decompose / film-pull；
2. 根对象仅含 shots 数组，镜数须为 ${expectedShotCount}（与机械映射草稿一致）；
3. 每镜含 index、timeSlice、sceneDescription、videoPrompt、voiceover、durationSec（3–15 整数）；
4. videoPrompt 须引用 @图片N（至少 1 张模特 + 1 张产品），禁止写入口播原文；
5. voiceover 仅写口播/字幕，禁止写入 videoPrompt；
6. videoPrompt 须保留原片布光/影调/色调/运镜，禁止删除或弱化；
7. 禁止尾逗号与 JSON 注释。`;
}

function normalizeReplicaScriptPatch(raw: unknown): ReplicaScriptPatch | null {
  if (!raw || typeof raw !== "object") return null;
  const shotsRaw = (raw as ReplicaScriptPatch).shots;
  if (!Array.isArray(shotsRaw) || shotsRaw.length === 0) return null;

  const shots = shotsRaw
    .map((row, i) => {
      if (!row || typeof row !== "object") return null;
      const r = row as Record<string, unknown>;
      const sceneDescription =
        typeof r.sceneDescription === "string" ? r.sceneDescription.trim() : "";
      const videoPrompt = typeof r.videoPrompt === "string" ? r.videoPrompt.trim() : "";
      const voiceover = typeof r.voiceover === "string" ? r.voiceover.trim() : "";
      if (!sceneDescription && !videoPrompt && !voiceover) return null;
      const index =
        Number.isFinite(r.index) && Number(r.index) > 0 ? Math.round(Number(r.index)) : i + 1;
      return {
        index,
        timeSlice: typeof r.timeSlice === "string" ? r.timeSlice : undefined,
        sceneDescription,
        videoPrompt,
        voiceover,
        durationSec:
          Number.isFinite(r.durationSec) && Number(r.durationSec) > 0
            ? Number(r.durationSec)
            : undefined,
        refImageLabel: typeof r.refImageLabel === "string" ? r.refImageLabel : undefined,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row != null);

  if (shots.length === 0) return null;
  return { shots };
}

function tryParseReplicaScriptJson(raw: string): ReplicaScriptPatch | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    return normalizeReplicaScriptPatch(JSON.parse(trimmed));
  } catch {
    return null;
  }
}

export function extractReplicaScriptPatch(text: string): ReplicaScriptPatch | null {
  const source = text.trim();
  if (!source) return null;

  for (const name of SCRIPT_FENCE_PARSE_ALIASES) {
    const closedRe = new RegExp("```" + name + "\\s*([\\s\\S]*?)```", "i");
    const closed = source.match(closedRe);
    if (closed?.[1]) {
      const patch = tryParseReplicaScriptJson(closed[1]);
      if (patch) return patch;
    }
    const openRe = new RegExp("```" + name + "\\s*([\\s\\S]*)$", "i");
    const open = source.match(openRe);
    if (open?.[1]) {
      const patch = tryParseReplicaScriptJson(open[1]);
      if (patch) return patch;
    }
  }

  const genericBlocks = [...source.matchAll(/```[\w-]*\s*([\s\S]*?)```/gi)];
  for (let i = genericBlocks.length - 1; i >= 0; i -= 1) {
    const patch = tryParseReplicaScriptJson(genericBlocks[i][1] ?? "");
    if (patch) return patch;
  }

  const start = source.lastIndexOf('{"shots"');
  if (start >= 0) {
    const end = source.lastIndexOf("}");
    if (end > start) {
      const patch = tryParseReplicaScriptJson(source.slice(start, end + 1));
      if (patch) return patch;
    }
  }

  return null;
}

export function mapReplicaScriptToShots(
  patch: ReplicaScriptPatch,
  fallback: SeedVideoShot[],
  primaryModel: SeedVideoReference,
  catalog: ReplicaMentionEntry[],
): SeedVideoShot[] {
  const defaultModelToken = catalog.find((e) => e.role === "model")?.token ?? "@图片1";
  return patch.shots.map((row, i) => {
    const fb = fallback[i] ?? fallback[fallback.length - 1];
    const index = Number.isFinite(row.index) && row.index > 0 ? row.index : i + 1;
    const durationSec =
      Number.isFinite(row.durationSec) && row.durationSec! > 0
        ? Math.max(3, Math.min(15, Math.round(row.durationSec!)))
        : (fb?.durationSec ?? 5);
    return {
      index,
      timeSlice: row.timeSlice?.trim() || fb?.timeSlice || `${index}`,
      refImageId: primaryModel.id,
      refImageLabel: row.refImageLabel?.trim() || defaultModelToken,
      sceneDescription: row.sceneDescription?.trim() || fb?.sceneDescription || "",
      videoPrompt: row.videoPrompt?.trim() || fb?.videoPrompt || "",
      voiceover: row.voiceover?.trim() ?? fb?.voiceover ?? "",
      durationSec,
    };
  });
}

export function buildDraftShotsFromDecompose(structured: MediaDecomposePatch): SeedVideoShot[] {
  const placeholder = {
    id: "ref-replica-model-draft",
    label: "@图片1",
    role: "seed-material" as const,
    ossUrl: "",
  };
  return buildReplicaShotsFromDecompose(structured, placeholder);
}

export function buildReplicaProductRecognizePrompt(imageCount = 1, userDraft?: string): string {
  const multi = imageCount > 1 ? `共 ${imageCount} 张产品图，请综合识别。` : "";
  const draft = userDraft?.trim();
  const draftBlock = draft
    ? `\n\n用户已填写的产品描述草稿（请结合产品图核对、补全、润色；保留正确信息，修正与图片不符之处）：\n${draft}`
    : "";
  return `你是电商产品识别助手。${multi}根据产品图输出简洁 JSON（不要 markdown 围栏）：
{"productName":"","category":"","sellingPoints":"","materialOrCraft":"","displayTips":""}
字段用中文，sellingPoints 为 1–3 条逗号分隔。${draftBlock}`;
}

export function buildReplicaModelImagePromptSystem(): string {
  return `你是电商短视频复刻的「新模特参考图」Prompt 专家。
根据原片拆解结果，写一条用于文生图（纯文本，无参考图）的 Prompt，生成将替换原片模特的新模特参考图。

要求：
- 全身或半身 lookbook 构图，适合后续带货短视频；
- 描述年龄段、气质、发型、妆容、服装风格（不含具体品牌与产品）；
- **继承原片布光方案、色彩体系/影调与画面氛围**；只换面孔与体型气质，不换光影逻辑与色调倾向；
- 中文或中英混合均可，一段连贯描述，80–200 字；
- 只输出 Prompt 正文，不要 markdown、不要 JSON、不要解释。`;
}

export function buildReplicaModelImagePromptUserMessage(structured: MediaDecomposePatch): string {
  if (structured.mediaType === "image") {
    const e = structured.elements;
    const l = e.lighting;
    return [
      "原片（静态图）拆解结果如下。请推断原片模特类型，并写一条**不同面孔**的新模特文生图 Prompt。",
      "",
      `布光参考：主 ${l.keyLight}；辅 ${l.fillLight}；方向 ${l.direction}；${l.hardSoft}；色温 ${l.colorTemperature}`,
      `色彩体系：${e.colorSystem}`,
      `画面氛围：${e.atmosphere}`,
      "",
      JSON.stringify(structured, null, 2),
    ].join("\n");
  }

  const tableJson = JSON.stringify(structured, null, 2);
  return [
    "原片（视频）拆解结果如下。请推断原片模特类型（性别、年龄感、风格），并写一条**不同面孔**的新模特文生图 Prompt。",
    "须继承全片 visualStyle / globalColorTone 与各镜 lightingSetup / toneContrast 所描述的光影与色调。",
    "",
    tableJson,
  ].join("\n");
}

export function normalizeReplicaModelImagePrompt(raw: string): string {
  return raw
    .replace(/^```[\s\S]*?```$/gm, "")
    .replace(/^["'`]|["'`]$/g, "")
    .trim();
}

function extractRecognitionJsonBody(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]?.trim()) return fenced[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) return text.slice(start, end + 1);
  return text.trim();
}

export function parseProductRecognitionResult(jsonText: string): {
  productBrief: string;
  sellingPoints: string;
} {
  try {
    const o = JSON.parse(extractRecognitionJsonBody(jsonText)) as Record<string, string>;
    const sellingPoints = typeof o.sellingPoints === "string" ? o.sellingPoints.trim() : "";
    const parts = [
      o.productName && `产品：${o.productName}`,
      o.category && `品类：${o.category}`,
      o.materialOrCraft && `材质/工艺：${o.materialOrCraft}`,
      o.displayTips && `展示建议：${o.displayTips}`,
    ].filter(Boolean);
    return { productBrief: parts.join("\n"), sellingPoints };
  } catch {
    return { productBrief: jsonText.trim(), sellingPoints: "" };
  }
}

export function formatProductBriefFromRecognition(jsonText: string): string {
  return parseProductRecognitionResult(jsonText).productBrief;
}

export function buildReplicaSellingPointsPrompt(opts: {
  imageCount: number;
  productBrief?: string;
  userDraft?: string;
}): string {
  const multi = opts.imageCount > 1 ? `共 ${opts.imageCount} 张产品图，请综合识别。` : "";
  const brief = opts.productBrief?.trim();
  const draft = opts.userDraft?.trim();
  const briefBlock = brief ? `\n\n已知产品/服装描述：\n${brief}` : "";
  if (draft) {
    return `你是电商短视频卖点文案助手。${multi}${briefBlock}

用户已填写的卖点草稿（请结合产品图核对、补全、润色为 1–3 条逗号分隔的中文卖点；保留正确信息）：
${draft}

只输出卖点正文（不要 JSON、不要 markdown、不要「卖点：」前缀），1–3 条逗号分隔。`;
  }
  return `你是电商短视频卖点文案助手。${multi}${briefBlock}

根据产品图生成 1–3 条中文卖点，逗号分隔，突出穿搭场景与 fabric/版型/配色等可感知利益点。
只输出卖点正文（不要 JSON、不要 markdown、不要「卖点：」前缀）。`;
}

const VOICEOVER_FENCE = "replica-voiceover";

export type ReplicaVoiceoverPatch = {
  shots: Array<{ index: number; voiceover: string }>;
};

export function buildReplicaVoiceoverSystemPrompt(): string {
  return `你是电商短视频口播编剧。根据原片分镜拆解、新产品描述与卖点，为每一镜写独立口播/字幕文案（供 TTS）。

规则：
1. 输出唯一围栏 \`\`\`${VOICEOVER_FENCE}\` ... \`\`\`，JSON 根对象含 shots 数组；
2. 每镜字段：index（镜号，从 1 起）、voiceover（该镜口播，中文，可空字符串表示本镜无口播）；
3. 镜数与用户提供的分镜表一致，index 一一对应；
4. 口播字数与 durationSec / 时长大致匹配（短视频口播，每镜约 5–20 字，长镜可略多）；
5. 融入卖点但不堆砌；语气自然、可带货；
6. 禁止 markdown 解释，只输出 JSON 围栏。`;
}

export function buildReplicaVoiceoverUserPrompt(opts: {
  structured: MediaDecomposePatch;
  productBrief: string;
  sellingPoints: string;
  shots: Array<{
    index: number;
    timeSlice: string;
    durationSec: number;
    sceneDescription?: string;
    voiceover?: string;
  }>;
}): string {
  const tableJson =
    opts.structured.mediaType === "video"
      ? JSON.stringify(opts.structured.storyboardTable, null, 2)
      : JSON.stringify(opts.structured, null, 2);
  const shotsJson = JSON.stringify(opts.shots, null, 2);
  return [
    "## 原片拆解分镜表",
    tableJson,
    "",
    "## 待写口播的分镜（镜号 / 时段 / 时长 / 画面描述 / 原片口播参考）",
    shotsJson,
    "",
    "## 新产品/服装描述",
    opts.productBrief.trim() || "（未填写，请根据上下文推断）",
    "",
    "## 卖点（可空）",
    opts.sellingPoints.trim() || "（未填写）",
    "",
    "请为每一镜输出替换后的 voiceover。",
  ].join("\n");
}

export function extractReplicaVoiceoverPatch(text: string): ReplicaVoiceoverPatch | null {
  const closed = text.match(new RegExp(`\`\`\`${VOICEOVER_FENCE}\\s*([\\s\\S]*?)\`\`\``, "i"));
  const raw = closed?.[1]?.trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ReplicaVoiceoverPatch;
    if (!Array.isArray(parsed.shots) || parsed.shots.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function normalizeSellingPointsText(raw: string): string {
  return raw
    .replace(/^```[\s\S]*?```$/gm, "")
    .replace(/^卖点[:：]\s*/i, "")
    .replace(/^["'`]|["'`]$/g, "")
    .trim();
}
