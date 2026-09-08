import type { CanvasChatContentPart } from "@/lib/canvas/providers/types";
import type { MediaDecomposePatch } from "@/lib/ecom/ecom-media-decompose-structured";
import type { ReplicaMentionEntry } from "@/lib/ecom/ecom-media-decompose-replica-refs";
import {
  collectReplicaStripFragments,
  formatReplicaAssetPlanForPrompt,
  listReplicaAssetPlanSlots,
  replicaAssetSlotToken,
  type ReplicaAssetPlan,
} from "@/lib/ecom/ecom-replica-asset-plan";
import type { SeedVideoReference, SeedVideoShot } from "@/lib/ecom/ecom-seed-video-types";
import {
  buildImageDecomposeDraftImagePrompt,
  buildReplicaShotsFromDecompose,
} from "@/lib/ecom/ecom-media-decompose-replica";

const FENCE = "replica-script";
/** 解析兜底：模型仍可能输出 ```json；契约层禁止，解析层宽容 */
const SCRIPT_FENCE_PARSE_ALIASES = [FENCE, "json"] as const;

export type ReplicaScriptPatch = {
  shots: Array<{
    index: number;
    timeSlice?: string;
    sceneDescription: string;
    imagePrompt?: string;
    videoPrompt: string;
    voiceover: string;
    durationSec?: number;
    refImageLabel?: string;
  }>;
};

function replicaScriptFenceContract(mediaType?: "image" | "video"): string {
  const imageShotFields =
    mediaType === "image"
      ? `
| imagePrompt | string | **拆图专用** · 分镜图 Prompt（静态定格画面）；景别/构图/布光/影调/色调/主体姿态；须含 @图片N；**禁止**口播与运镜动词 |
| videoPrompt | string | **拆图专用** · 分镜视频 Prompt；运镜/微动/节奏/光影延续；须含 @图片N；**不得**与 imagePrompt 逐字相同；**禁止**口播原文 |
`
      : `
| videoPrompt | string | 景别/运镜/构图/布光/影调/全片色调/动作/音效/BGM/转场/剪辑；须含 @图片N；**禁止**口播原文 |
`;

  const imageExample =
    mediaType === "image"
      ? `
### 示例（拆图 · 1 镜）
\`\`\`${FENCE}
{
  "shots": [
    {
      "index": 1,
      "timeSlice": "0-5s",
      "sceneDescription": "新模特 @图片1 手持 @图片2 面向镜头",
      "imagePrompt": "@图片1 @图片2，中景，三分法构图，柔光侧顺光，暖金色调，lookbook 定格姿态",
      "videoPrompt": "@图片1 @图片2，固定机位缓慢推镜，人物自然微动，延续柔光侧顺光与暖金色调",
      "voiceover": "",
      "durationSec": 5
    }
  ]
}
\`\`\`
`
      : `
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

  return `
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
${imageShotFields}| voiceover | string | 仅口播/字幕（可空字符串）；**禁止**写入 videoPrompt |
| durationSec | number | 3–15 整数 |

${imageExample}
`;
}

export function buildReplicaScriptSystemPrompt(
  catalog: ReplicaMentionEntry[],
  opts?: { mediaType?: "image" | "video"; assetPlan?: ReplicaAssetPlan },
): string {
  const mentionLines = catalog.map((e) => `${e.token}：${e.ref.label}（${e.role}）`);
  const mentionBlock = mentionLines.length
    ? mentionLines.join("\n")
    : "（用户尚未上传替换图；各槽位 inherit 原片描述，禁止写 @token）";
  const mediaType = opts?.mediaType ?? "video";
  const useSemanticTokens = Boolean(opts?.assetPlan && listReplicaAssetPlanSlots(opts.assetPlan).length > 0);
  const tokenHint = useSemanticTokens
    ? "@人物A @产品1 @道具1 @场景1 等语义 token（仅 replace 槽位）"
    : "@图片N";
  const assetPlanBlock = opts?.assetPlan
    ? `\n## 复刻资产方案（四槽 · 须严格对齐）\n${formatReplicaAssetPlanForPrompt(opts.assetPlan)}\n`
    : "";
  const imageRules =
    mediaType === "image"
      ? `
7. **拆图复刻**：每镜须同时输出 imagePrompt（静态分镜图）与 videoPrompt（分镜视频）；
   - imagePrompt 以机械草稿 imagePrompt（= positivePrompt + elements 全字段 + liveActionReplication 静态实拍要素）为**完整骨架**，只做模特/产品替换与 @图片N 引用，**字符数不得低于机械草稿 imagePrompt 的 75%**，禁止压缩成短句；
   - videoPrompt 须继承 mechanical draft 中的机位/镜头参数/布光/运镜/微动，**不得**与 imagePrompt 逐字相同；
`
      : "";
  return `你是电商短视频复刻编剧。用户已从原视频/图拆解出分镜，并按「人物 / 产品 / 道具 / 场景」四槽准备了可选替换参考图。
你的任务：在保留原片镜头语言、节奏、景别、运镜、**布光、影调、全片色调与视觉风格**的前提下，将 **replace 槽位** 替换为用户上传的参考图（语义 token），**inherit 槽位** 保留原片文字描述且 **禁止** 写对应 @token。

已上传替换图（仅这些 token 可在 Prompt 中出现）：
${mentionBlock}
${assetPlanBlock}
${replicaScriptFenceContract(mediaType)}

### 业务规则（与 JSON 一并满足）
1. videoPrompt 与 voiceover **严格分离**（见上表）；
2. **inherit / replace 分轨**：用户未上传的槽位 inherit 原片描述（人物含外貌+服装）；已上传的人物槽 **replace** 时只写 ${tokenHint} + 站位/动作，**禁止**写原片服装文字；已上传的产品/道具/场景槽须写 token 与展示/摆放关系；
2a. **videoPrompt 角色分轨（强制）**：每镜 videoPrompt **开头**先写「人物 @人物A …；产品 @产品1 …」分轨（仅 replace 槽），再写景别/运镜/布光/音效；**禁止**把人物外貌/服装与产品外观混在同一句；
2b. **参考图只绑定一次**：用户消息开头已按 token 附上参考图；各镜 imagePrompt / videoPrompt / sceneDescription 内**只需写 @token 文本**，**禁止**重复粘贴/描述参考图外观，**禁止**在 JSON 中嵌入图片 URL；
3. 多人物时：人物A/B/C… 须分别对应方案中的描述，禁止把多人合并成一句「两位模特」；
4. 机械映射草稿的 videoPrompt 已含景别/运镜/布光/影调/音效/BGM/转场/剪辑；改写时须保留信息密度，**不得删减**光影、影调、色调与运镜描述；
5. **继承**原片场景、道具感、BGM/音效气质、转场与剪辑节奏；**只替换** replace 槽位相关描述；
6. cameraMove 不得弱化（慢推不可改固定，横移不可省略）；
7. sceneDescription 用中文描述换素材后的画面；
8. 镜数与拆解表一致，除非原表为空则输出 1 镜。${imageRules}`;
}

export function buildReplicaScriptUserPrompt(opts: {
  structured: MediaDecomposePatch;
  productBrief: string;
  sellingPoints?: string;
  draftShots: SeedVideoShot[];
  mentionSummary: string;
  assetPlan?: ReplicaAssetPlan;
  assetReplaceSummary?: string;
  productDisplayAction?: string;
}): string {
  const tableJson = JSON.stringify(opts.structured, null, 2);
  const draftJson = JSON.stringify(
    opts.draftShots.map((s) => ({
      index: s.index,
      timeSlice: s.timeSlice,
      sceneDescription: s.sceneDescription,
      imagePrompt: s.imagePrompt,
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
  const imageFocusBlock =
    opts.structured.mediaType === "image"
      ? (() => {
          const draftImageLen = buildImageDecomposeDraftImagePrompt(opts.structured).length;
          return [
            "",
            "## 拆图复刻 · Prompt 完整性（强制）",
            `- 机械草稿 imagePrompt 长度约 ${draftImageLen} 字（含 positivePrompt + elements 全维度 + liveActionReplication 静态实拍要素）；改写后 imagePrompt **不得低于该长度的 75%**；`,
            "- imagePrompt 须保留：主体/姿态/场景/透视/构图/等效焦距/拍摄角度/布光/材质/色彩/氛围/细节/场景搭建/机位/灯光/道具/相机参数/后期等维度；",
            "- videoPrompt 在 imagePrompt 信息基础上补充运镜或微动，禁止只输出一句概括；",
            "- 仅替换旧模特/旧产品相关描述，加入 @图片N；**禁止**删减光影、影调、色调与镜头语言。",
          ].join("\n");
        })()
      : "";
  return [
    "## 拆解结果（原片）",
    tableJson,
    "",
    "## 机械映射草稿（待你改写 replace/inherit）",
    draftJson,
    imageFocusBlock,
    opts.assetPlan
      ? ["", "## 复刻资产方案（四槽）", formatReplicaAssetPlanForPrompt(opts.assetPlan)].join("\n")
      : "",
    opts.assetReplaceSummary
      ? ["", "## 槽位 replace / inherit 对照（强制）", opts.assetReplaceSummary].join("\n")
      : "",
    opts.productDisplayAction?.trim()
      ? ["", "## 产品展示动作（识产品结果 · replace 产品槽时须写入 Prompt）", opts.productDisplayAction.trim()].join(
          "\n",
        )
      : "",
    "",
    "## 已上传替换图",
    opts.mentionSummary.trim() || "（无；全部 inherit）",
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
  assetPlan?: ReplicaAssetPlan;
  assetReplaceSummary?: string;
  productDisplayAction?: string;
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
        assetPlan: opts.assetPlan,
        assetReplaceSummary: opts.assetReplaceSummary,
        productDisplayAction: opts.productDisplayAction,
      }),
    },
  ];

  for (const entry of opts.mentionCatalog.slice(0, 12)) {
    const url = entry.ref.ossUrl?.trim();
    if (!url) continue;
    parts.push({ type: "image_url", image_url: { url } });
    parts.push({
      type: "text",
      text: `${entry.token}（${entry.ref.label ?? entry.role} · replace 参考图，下文 Prompt 只写 token 勿重复描述外观）`,
    });
  }

  if (opts.mentionCatalog.some((e) => e.ref.ossUrl?.trim())) {
    parts.push({
      type: "text",
      text: "【参考图绑定完成】以上每张图仅出现一次；改写各镜时只使用对应 @token，勿在 JSON 中重复描述参考图外貌/产品细节。",
    });
  }

  return parts;
}

export function buildReplicaScriptRetryUserPrompt(
  expectedShotCount: number,
  mediaType?: "image" | "video",
  opts?: { mentionCatalog?: ReplicaMentionEntry[]; assetPlan?: ReplicaAssetPlan },
): string {
  const useSemantic =
    Boolean(opts?.assetPlan && listReplicaAssetPlanSlots(opts.assetPlan).length > 0) ||
    (opts?.mentionCatalog?.some((e) => e.token.startsWith("@人物")) ?? false);
  const tokenRule = useSemantic
    ? `4. Prompt 须引用已上传 replace 槽的语义 token（${opts?.mentionCatalog?.map((e) => e.token).join(" ") || "@人物A @产品1"}）；inherit 槽禁止写 @token；`
    : "4. videoPrompt 须引用 @图片N（至少 1 张模特 + 1 张产品），禁止写入口播原文；";
  const imageFields =
    mediaType === "image"
      ? `
3b. 拆图复刻：每镜 **必须**含 imagePrompt（完整继承 mechanical draft：positivePrompt + elements + liveActionReplication 静态要素，≥草稿 75% 字数）与 videoPrompt（含运镜/微动）；
3c. imagePrompt 与 videoPrompt **禁止**压缩成短句；`
      : "";
  return `上次输出未通过机器校验：缺少可解析的 \`\`\`${FENCE} 围栏，或使用了 json 等其他围栏名，或 shots 为空/字段不完整。

请**仅**重输出完整 \`\`\`${FENCE} 围栏（可省略 Markdown 前言），并严格遵守：
1. 围栏语言标记必须是 ${FENCE}，**禁止** json / media-decompose / film-pull；
2. 根对象仅含 shots 数组，镜数须为 ${expectedShotCount}（与机械映射草稿一致）；
3. 每镜含 index、timeSlice、sceneDescription、videoPrompt、voiceover、durationSec（3–15 整数）；${imageFields}
${tokenRule}
5. voiceover 仅写口播/字幕，禁止写入 videoPrompt；
6. videoPrompt 须保留原片布光/影调/色调/运镜，禁止删除或弱化；
7. 禁止尾逗号与 JSON 注释。`;
}

/** LLM 过度压缩时回退到机械草稿，避免复刻 Prompt 信息密度丢失；保留 LLM 中的 @token，且剥离 replace 槽旧描述 */
export function pickReplicaPromptPreservingDensity(
  llmPrompt: string | undefined,
  draftPrompt: string,
  minLengthRatio = 0.75,
  stripFragments?: string[],
): string {
  const llm = llmPrompt?.trim() ?? "";
  let draft = draftPrompt.trim();
  if (stripFragments?.length) {
    draft = stripWardrobeTextFromPrompt(draft, stripFragments);
    draft = stripGarmentClausesFromPrompt(draft);
  }
  if (!draft) return llm;
  if (!llm) return draft;
  if (llm.length >= draft.length * minLengthRatio) return llm;
  const tokens = [...llm.matchAll(/@(?:人物[A-F\d]+|产品\d+|道具\d+|场景\d+)/g)].map((m) => m[0]);
  const uniqueTokens = [...new Set(tokens)];
  if (uniqueTokens.length === 0) return draft;
  const missing = uniqueTokens.filter((t) => !draft.includes(t));
  if (missing.length === 0) {
    return mergeReplicaPromptTokensWithDraftCinematic(llm, draft, uniqueTokens);
  }
  return mergeReplicaPromptTokensWithDraftCinematic(`${missing.join(" ")}，${llm}`, draft, uniqueTokens);
}

function mergeReplicaPromptTokensWithDraftCinematic(
  llm: string,
  draft: string,
  tokens: string[],
): string {
  const base = llm.trim();
  if (!draft.trim()) return base;
  const segments = draft
    .split(/[，,、；;\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 4);
  const extras = segments.filter(
    (seg) => !base.includes(seg) && !tokens.some((t) => seg.includes(t)),
  );
  if (extras.length === 0) return base;
  return `${base}，${extras.join("，")}`;
}

const GARMENT_CLAUSE_PATTERNS: RegExp[] = [
  /(?:wearing|dressed in|clad in)\s+[^，,；;.\n]+/gi,
  /(?:white|black|grey|gray|brown|red|blue|green|dark|light)[\w\s-]*(?:shirt|t-shirt|tee|trousers|pants|jeans|shorts|sandals|shoes|sneakers|dress|skirt|jacket|coat|hoodie|polo|blouse|sweater)[^.，,；;\n]*/gi,
  /(?:穿着|身穿|身着)[^，,；;\n]{2,48}/g,
  /(?:白色|黑色|灰色|棕色|红色|蓝色|绿色|深色|浅色)[^，,；;\n]{0,10}(?:衬衫|T恤|短袖|长袖|长裤|短裤|裤|裙|鞋|凉鞋|运动鞋|外套|夹克|卫衣|Polo|开衫|连衣裙)[^，,；;\n]*/g,
];

/** replace 人物时剥离中英服装从句（机械草稿/LLM 漏删兜底） */
export function stripGarmentClausesFromPrompt(prompt: string): string {
  let result = prompt;
  for (const pattern of GARMENT_CLAUSE_PATTERNS) {
    result = result.replace(pattern, "");
  }
  return result
    .replace(/[，,、；;]{2,}/g, "，")
    .replace(/^[，,、；;\s]+|[，,、；;\s]+$/g, "")
    .trim();
}

const REPLICA_MENTION_TOKEN_RE = /@(?:人物[A-F\d]+|产品\d+|道具\d+|场景\d+)/g;

function extractReplicaMentionTokens(text: string): string[] {
  return [...new Set([...text.matchAll(REPLICA_MENTION_TOKEN_RE)].map((m) => m[0]))];
}

/** 将 imagePrompt 中的 replace token 同步到 videoPrompt（密度回退后 video 常丢失 @） */
export function mergeReplicaReplaceTokensFromImageToVideo(
  imagePrompt: string,
  videoPrompt: string,
): string {
  const imageTokens = extractReplicaMentionTokens(imagePrompt);
  if (imageTokens.length === 0) return videoPrompt;
  const missing = imageTokens.filter((t) => !videoPrompt.includes(t));
  if (missing.length === 0) return videoPrompt;
  const trimmed = videoPrompt.trim();
  return trimmed ? `${missing.join(" ")}，${trimmed}` : missing.join(" ");
}

/** replace 人物槽时从 Prompt 剥离原片服装片段 */
export function stripWardrobeTextFromPrompt(prompt: string, wardrobeFragments: string[]): string {
  let result = prompt;
  const parts = new Set<string>();
  for (const fragment of wardrobeFragments) {
    const trimmed = fragment.trim();
    if (trimmed.length >= 3) parts.add(trimmed);
    for (const seg of trimmed.split(/[，,、；;\n]/)) {
      const p = seg.trim();
      if (p.length >= 4) parts.add(p);
    }
  }
  const sorted = [...parts].sort((a, b) => b.length - a.length);
  for (const part of sorted) {
    if (result.includes(part)) {
      result = result.split(part).join("");
    }
  }
  return result
    .replace(/[，,、；;]{2,}/g, "，")
    .replace(/^[，,、；;\s]+|[，,、；;\s]+$/g, "")
    .trim();
}

/** 将 replace 槽 token 按人物/产品分轨置于 Prompt 开头 */
export function structureReplicaPromptByRole(
  prompt: string,
  opts: {
    assetPlan: ReplicaAssetPlan;
    uploadedSlotIds: ReadonlySet<string>;
    productDisplayAction?: string;
  },
): string {
  const characterTokens: string[] = [];
  const productTokens: string[] = [];
  const propTokens: string[] = [];
  const sceneTokens: string[] = [];

  for (const slot of listReplicaAssetPlanSlots(opts.assetPlan)) {
    if (!opts.uploadedSlotIds.has(slot.id)) continue;
    const token = replicaAssetSlotToken(slot);
    switch (slot.category) {
      case "character":
        characterTokens.push(token);
        break;
      case "product":
        productTokens.push(token);
        break;
      case "prop":
        propTokens.push(token);
        break;
      case "scene":
        sceneTokens.push(token);
        break;
    }
  }

  const hasReplace = characterTokens.length + productTokens.length + propTokens.length + sceneTokens.length > 0;
  if (!hasReplace) return prompt.trim();

  const trimmed = prompt.trim();
  if (/^人物\s@/.test(trimmed) || /^【人物】/.test(trimmed)) return trimmed;

  const headerParts: string[] = [];
  if (characterTokens.length) headerParts.push(`人物 ${characterTokens.join(" ")}`);
  if (productTokens.length) {
    const action = opts.productDisplayAction?.trim();
    headerParts.push(
      action ? `产品 ${productTokens.join(" ")}（${action}）` : `产品 ${productTokens.join(" ")}`,
    );
  }
  if (propTokens.length) headerParts.push(`道具 ${propTokens.join(" ")}`);
  if (sceneTokens.length) headerParts.push(`场景 ${sceneTokens.join(" ")}`);

  const header = headerParts.join("；");
  if (!trimmed) return header;
  if (characterTokens.some((t) => trimmed.startsWith(t)) || productTokens.some((t) => trimmed.startsWith(t))) {
    return `${header}。${trimmed}`;
  }
  return `${header}。${trimmed}`;
}

/** 脚本生成后：剥离 replace 人物旧服装、同步 image→video 的 @token、分轨人物/产品 */
export function applyReplicaReplacePostProcess(
  shots: SeedVideoShot[],
  opts: {
    assetPlan: ReplicaAssetPlan;
    uploadedSlotIds: ReadonlySet<string>;
    productDisplayAction?: string;
  },
): SeedVideoShot[] {
  const stripFragments = collectReplicaStripFragments(opts.assetPlan, opts.uploadedSlotIds);
  const characterReplaced = opts.assetPlan.characters.some((s) => opts.uploadedSlotIds.has(s.id));
  const productReplaced = opts.assetPlan.products.some((s) => opts.uploadedSlotIds.has(s.id));
  const displayAction = opts.productDisplayAction?.trim();

  return shots.map((shot) => {
    let sceneDescription = shot.sceneDescription;
    let imagePrompt = shot.imagePrompt ?? "";
    let videoPrompt = shot.videoPrompt;

    if (stripFragments.length > 0) {
      sceneDescription = stripWardrobeTextFromPrompt(sceneDescription, stripFragments);
      imagePrompt = stripWardrobeTextFromPrompt(imagePrompt, stripFragments);
      videoPrompt = stripWardrobeTextFromPrompt(videoPrompt, stripFragments);
    }
    if (characterReplaced) {
      sceneDescription = stripGarmentClausesFromPrompt(sceneDescription);
      imagePrompt = stripGarmentClausesFromPrompt(imagePrompt);
      videoPrompt = stripGarmentClausesFromPrompt(videoPrompt);
    }

    imagePrompt = structureReplicaPromptByRole(imagePrompt, opts);
    videoPrompt = structureReplicaPromptByRole(videoPrompt, opts);

    videoPrompt = mergeReplicaReplaceTokensFromImageToVideo(imagePrompt, videoPrompt);

    if (productReplaced && displayAction && !videoPrompt.includes(displayAction)) {
      videoPrompt = videoPrompt ? `${videoPrompt}，${displayAction}` : displayAction;
      if (imagePrompt && !imagePrompt.includes(displayAction)) {
        imagePrompt = `${imagePrompt}，${displayAction}`;
      }
    }

    return {
      ...shot,
      sceneDescription,
      imagePrompt: imagePrompt || undefined,
      videoPrompt,
    };
  });
}

/** 拆图复刻 · 脚本合并后确保 image/video Prompt 不低于机械草稿密度 */
export function finalizeImageReplicaScriptShots(
  structured: MediaDecomposePatch,
  shots: SeedVideoShot[],
  replaceOpts?: { assetPlan: ReplicaAssetPlan; uploadedSlotIds: ReadonlySet<string> },
): SeedVideoShot[] {
  if (structured.mediaType !== "image") return shots;
  const stripFragments = replaceOpts
    ? collectReplicaStripFragments(replaceOpts.assetPlan, replaceOpts.uploadedSlotIds)
    : [];
  const drafts = buildDraftShotsFromDecompose(structured);
  return shots.map((shot, i) => {
    const draft = drafts[i] ?? drafts[drafts.length - 1];
    if (!draft) return shot;
    const draftImage =
      draft.imagePrompt?.trim() ||
      buildImageDecomposeDraftImagePrompt(structured) ||
      structured.positivePrompt.trim();
    const draftVideo = draft.videoPrompt.trim();
    return {
      ...shot,
      imagePrompt: pickReplicaPromptPreservingDensity(shot.imagePrompt, draftImage, 0.75, stripFragments),
      videoPrompt: pickReplicaPromptPreservingDensity(shot.videoPrompt, draftVideo, 0.65, stripFragments),
    };
  });
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
      const imagePrompt = typeof r.imagePrompt === "string" ? r.imagePrompt.trim() : "";
      const videoPrompt = typeof r.videoPrompt === "string" ? r.videoPrompt.trim() : "";
      const voiceover = typeof r.voiceover === "string" ? r.voiceover.trim() : "";
      if (!sceneDescription && !imagePrompt && !videoPrompt && !voiceover) return null;
      const index =
        Number.isFinite(r.index) && Number(r.index) > 0 ? Math.round(Number(r.index)) : i + 1;
      return {
        index,
        timeSlice: typeof r.timeSlice === "string" ? r.timeSlice : undefined,
        sceneDescription,
        imagePrompt: imagePrompt || undefined,
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
  const defaultModelToken =
    catalog.find((e) => e.role === "character" || e.role === "model")?.token ?? "@人物A";
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
      imagePrompt: row.imagePrompt?.trim() || fb?.imagePrompt || "",
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
{"productName":"","category":"","materialOrCraft":"","displayTips":"","displayAction":"","displayActionDetail":""}
字段用中文。displayAction 为展示动作类型（如：手持展示/佩戴/抱着/摆放/试穿/开箱等，按品类选择最自然的一种）；displayActionDetail 为 1 句可写入 Prompt 的具体动作描述（含与人物/场景的空间关系）。**不要**输出 sellingPoints（卖点由用户另行生成）。${draftBlock}`;
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
    "优先参考根字段 talentAnalysis（全片模特）与 wardrobeAnalysis（全片服装），不要只看开场 3 秒。",
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
  displayAction?: string;
  displayActionDetail?: string;
} {
  try {
    const o = JSON.parse(extractRecognitionJsonBody(jsonText)) as Record<string, string>;
    const sellingPoints = typeof o.sellingPoints === "string" ? o.sellingPoints.trim() : "";
    const displayAction = typeof o.displayAction === "string" ? o.displayAction.trim() : "";
    const displayActionDetail =
      typeof o.displayActionDetail === "string" ? o.displayActionDetail.trim() : "";
    const parts = [
      o.productName && `产品：${o.productName}`,
      o.category && `品类：${o.category}`,
      o.materialOrCraft && `材质/工艺：${o.materialOrCraft}`,
      o.displayTips && `展示建议：${o.displayTips}`,
      displayAction && `展示动作：${displayAction}`,
      displayActionDetail && `动作细节：${displayActionDetail}`,
    ].filter(Boolean);
    return {
      productBrief: parts.join("\n"),
      sellingPoints,
      ...(displayAction ? { displayAction } : {}),
      ...(displayActionDetail ? { displayActionDetail } : {}),
    };
  } catch {
    return { productBrief: jsonText.trim(), sellingPoints: "" };
  }
}

/** 识产品 · 写入脚本的展示动作（优先 detail，其次 action） */
export function formatReplicaProductDisplayAction(parsed: {
  displayAction?: string;
  displayActionDetail?: string;
}): string {
  const detail = parsed.displayActionDetail?.trim();
  if (detail) return detail;
  const action = parsed.displayAction?.trim();
  return action ?? "";
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
  const transcript =
    opts.structured.mediaType === "video" ? opts.structured.fullTranscript.trim() : "";
  return [
    "## 原片完整台词全文",
    transcript || "（无）",
    "",
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
