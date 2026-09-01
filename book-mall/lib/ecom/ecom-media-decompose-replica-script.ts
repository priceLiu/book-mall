import type { MediaDecomposePatch } from "@/lib/ecom/ecom-media-decompose-structured";
import type { ReplicaMentionEntry } from "@/lib/ecom/ecom-media-decompose-replica-refs";
import type { SeedVideoReference, SeedVideoShot } from "@/lib/ecom/ecom-seed-video-types";
import { buildReplicaShotsFromDecompose } from "@/lib/ecom/ecom-media-decompose-replica";

const FENCE = "replica-script";

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
你的任务：在保留原片镜头语言、节奏、景别与运镜的前提下，将画面与口播中的旧模特、旧产品替换为新模特与新商品。

参考图编号（须在 videoPrompt 中按需引用）：
${mentionBlock}

规则：
1. 输出唯一围栏 \`\`\`${FENCE}\` ... \`\`\`，JSON 根对象含 shots 数组；
2. 每镜字段：index、timeSlice、sceneDescription、videoPrompt、voiceover、durationSec（3–15 整数）；
3. videoPrompt 与 voiceover 严格分离：
   - videoPrompt：镜头视觉与制作语言。须合并原片拆解中的景别、运镜、镜头角度、构图、画面内容、人物动作、表情、音效、BGM、转场、剪辑节奏（替换为新模特/新产品后）；须引用相关 @图片N（至少包含 1 张模特与 1 张产品编号）；禁止写入字幕文案、配音台词或任何口播原文。
   - voiceover：仅写替换产品名与卖点后的口播/字幕（供 TTS）；保留原节奏与句式结构；禁止写入 videoPrompt。
4. 机械映射草稿的 videoPrompt 已含上述非口播字段；改写时须保留信息密度，不得删音效、BGM、转场、剪辑节奏；
5. sceneDescription 用中文描述换模特换产品后的画面；
6. 镜数与拆解表一致，除非原表为空则输出 1 镜。`;
}

export function buildReplicaScriptUserPrompt(opts: {
  structured: MediaDecomposePatch;
  productBrief: string;
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
    "请输出替换后的 replica-script JSON。",
  ].join("\n");
}

export function extractReplicaScriptPatch(text: string): ReplicaScriptPatch | null {
  const closed = text.match(new RegExp(`\`\`\`${FENCE}\\s*([\\s\\S]*?)\`\`\``, "i"));
  const raw = closed?.[1]?.trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ReplicaScriptPatch;
    if (!Array.isArray(parsed.shots) || parsed.shots.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
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
- 中性简洁摄影棚或 lifestyle 背景，柔和均匀光；
- 中文或中英混合均可，一段连贯描述，80–200 字；
- 只输出 Prompt 正文，不要 markdown、不要 JSON、不要解释。`;
}

export function buildReplicaModelImagePromptUserMessage(structured: MediaDecomposePatch): string {
  const tableJson = JSON.stringify(structured, null, 2);
  return [
    "原片拆解结果如下。请推断原片模特类型（性别、年龄感、风格），并写一条**不同面孔**的新模特文生图 Prompt，用于替换原模特：",
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

export function formatProductBriefFromRecognition(jsonText: string): string {
  try {
    const o = JSON.parse(extractRecognitionJsonBody(jsonText)) as Record<string, string>;
    const parts = [
      o.productName && `产品：${o.productName}`,
      o.category && `品类：${o.category}`,
      o.sellingPoints && `卖点：${o.sellingPoints}`,
      o.materialOrCraft && `材质/工艺：${o.materialOrCraft}`,
      o.displayTips && `展示建议：${o.displayTips}`,
    ].filter(Boolean);
    return parts.join("\n");
  } catch {
    return jsonText.trim();
  }
}
