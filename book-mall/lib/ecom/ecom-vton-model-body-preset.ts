/** 模特试衣 · 生模特 / 扩全身 · 体型与描述预设 */

export type VtonModelBodyPresetId =
  | "slim"
  | "standard"
  | "athletic"
  | "curvy"
  | "soft"
  | "plus"
  | "tall_slim"
  | "petite";

export type VtonModelAgeGroupId = "youth" | "young_adult" | "mature";

export type VtonModelBodyMetrics = {
  heightCm?: string;
  weightKg?: string;
  bustCm?: string;
  waistCm?: string;
  hipsCm?: string;
};

export type VtonModelPipelineDescribeInput = {
  bodyPreset?: string | null;
  ageGroup?: string | null;
  featureDetail?: string | null;
  metrics?: VtonModelBodyMetrics | null;
};

const BODY_PRESET_PROMPT: Record<VtonModelBodyPresetId, string> = {
  slim: "体型纤细修长，但保持健康成年人体量，禁止病态瘦或竹竿身材。",
  standard: "健康匀称的成年人电商试衣体型，肩宽自然、腰臀过渡自然。",
  athletic: "运动健美体型，肩背与上臂有正常肌肉线条，腰臀仍自然。",
  curvy: "曲线丰满的时装模特体型，胸臀曲线明显，比例协调。",
  soft: "微胖圆润体型，腰腹柔和，仍属成人时装目录身材。",
  plus: "大码时装模特体型，肩宽与围度符合大码电商展示，禁止夸张 caricature。",
  tall_slim: "高挑修长体型，腿长占比明显，约 7.5～8 头身。",
  petite: "娇小成人模特，整体尺度偏小但保持真实成人头身比例。",
};

const AGE_GROUP_PROMPT: Record<VtonModelAgeGroupId, string> = {
  youth: "外观为青年（约 20～28 岁），面容年轻。",
  young_adult: "外观为轻熟青年（约 25～35 岁）。",
  mature: "外观为成熟成人（约 35～45 岁），仍适合电商时装展示。",
};

export function coerceVtonModelBodyPreset(raw?: string | null): VtonModelBodyPresetId {
  const v = raw?.trim();
  if (v && v in BODY_PRESET_PROMPT) return v as VtonModelBodyPresetId;
  return "standard";
}

export function coerceVtonModelAgeGroup(raw?: string | null): VtonModelAgeGroupId {
  const v = raw?.trim();
  if (v && v in AGE_GROUP_PROMPT) return v as VtonModelAgeGroupId;
  return "youth";
}

function metricsPrompt(metrics?: VtonModelBodyMetrics | null): string {
  if (!metrics) return "";
  const parts: string[] = [];
  const h = metrics.heightCm?.trim();
  const w = metrics.weightKg?.trim();
  const bust = metrics.bustCm?.trim();
  const waist = metrics.waistCm?.trim();
  const hips = metrics.hipsCm?.trim();
  if (h) parts.push(`身高约 ${h} cm`);
  if (w) parts.push(`体重约 ${w} kg`);
  if (bust) parts.push(`胸围约 ${bust} cm`);
  if (waist) parts.push(`腰围约 ${waist} cm`);
  if (hips) parts.push(`臀围约 ${hips} cm`);
  if (parts.length === 0) return "";
  return `身材参考（软约束，须与参考图身份协调）：${parts.join("，")}。`;
}

/** 拼入生图 / 扩全身的用户向描述段（不含主 Prompt 模板） */
export function buildVtonModelPipelineDescribeAppend(input: VtonModelPipelineDescribeInput): string {
  const preset = coerceVtonModelBodyPreset(input.bodyPreset);
  const age = coerceVtonModelAgeGroup(input.ageGroup);
  const chunks = [AGE_GROUP_PROMPT[age], BODY_PRESET_PROMPT[preset], metricsPrompt(input.metrics ?? undefined)];
  const detail = input.featureDetail?.trim();
  if (detail) chunks.push(`外貌细节：${detail}`);
  return chunks.filter(Boolean).join("\n");
}

export function mergeVtonModelPipelinePrompt(
  basePrompt: string,
  describeAppend: string,
): string {
  const base = basePrompt.trim();
  const extra = describeAppend.trim();
  if (!extra) return base;
  if (!base) return extra;
  return `${base}\n${extra}`;
}
