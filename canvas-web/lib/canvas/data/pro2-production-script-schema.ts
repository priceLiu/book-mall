/**
 * Pro2 制作包 · 结构化 JSON 契约（canvas-web 真源）
 * book-mall/lib/canvas/data/pro2-production-script-schema.ts 须保持同步
 */
import { z } from "zod";

export const PRO2_PRODUCTION_SCRIPT_SCHEMA_VERSION = 3 as const;
export const PRO2_PRODUCTION_SCRIPT_SCHEMA_VERSION_V2 = 2 as const;
export const PRO2_PRODUCTION_SCRIPT_SCHEMA_VERSION_LEGACY = 1 as const;
export const PRO2_PRODUCTION_SCRIPT_SCHEMA_VERSIONS = [1, 2, 3] as const;
export type Pro2ProductionScriptSchemaVersion =
  (typeof PRO2_PRODUCTION_SCRIPT_SCHEMA_VERSIONS)[number];

export const PRO2_PACK_PROFILES = ["director", "industrial"] as const;
export type Pro2PackProfile = (typeof PRO2_PACK_PROFILES)[number];

export const PRO2_SCRIPT_SOURCES = ["creative", "film_pull"] as const;
export type Pro2ScriptSource = (typeof PRO2_SCRIPT_SOURCES)[number];

export const PRO2_PRODUCTION_SCRIPT_TIERS = ["standard", "pro", "fine"] as const;
export type Pro2ProductionScriptTier = (typeof PRO2_PRODUCTION_SCRIPT_TIERS)[number];

export const PRO2_PRODUCTION_SCRIPT_STEPS = [
  "full_pack",
  "outline",
  "character",
  "scene",
  "storyboard",
  "shot_prompts",
] as const;
export type Pro2ProductionScriptStep = (typeof PRO2_PRODUCTION_SCRIPT_STEPS)[number];

const colorBlockObjectSchema = z.object({
  primary: z.string().min(1),
  secondary: z.string().optional(),
  highlight: z.string().optional(),
  shadow: z.string().optional(),
  notes: z.string().optional(),
});

/** LLM 常把 colorBlock 写成「暖金侧逆光」字符串；收成 { primary }，空/占位则省略 */
export function coercePro2ColorBlockInput(value: unknown): unknown {
  if (value == null) return undefined;
  if (typeof value === "string") {
    const t = value.trim();
    if (!t || t === "—" || t === "-" || t === "无") return undefined;
    return { primary: t };
  }
  return value;
}

const colorBlockSchema = z.preprocess(
  coercePro2ColorBlockInput,
  colorBlockObjectSchema.optional(),
);

const paletteSchema = z.object({
  primary: z.string().optional(),
  highlight: z.string().optional(),
  shadow: z.string().optional(),
});

const shootingPrepSchema = z.object({
  venue: z.string().min(1),
  costume: z.string().min(1),
  props: z.string().min(1),
  equipment: z.string().min(1),
});

const metaSchema = z.object({
  title: z.string().optional(),
  synopsis: z.string().optional(),
  packProfile: z.enum(PRO2_PACK_PROFILES).optional(),
  source: z.enum(PRO2_SCRIPT_SOURCES).optional(),
  totalDurationSec: z.number().positive().optional(),
  editRhythmCurve: z.string().optional(),
  shotSequenceLogic: z.string().optional(),
  cameraLanguageSummary: z.string().optional(),
  audioDesignLogic: z.string().optional(),
  narrativeLogic: z.string().optional(),
  beatPoints: z.string().optional(),
  replicableShootingScript: z.string().optional(),
  shootingPrep: shootingPrepSchema.optional(),
});

const visualStyleSchema = z.object({
  worldBackground: z.string().optional(),
  era: z.string().optional(),
  globalColorTone: z.string().optional(),
  pictureStyle: z.string().optional(),
  cinematography: z.string().optional(),
  dayPalette: paletteSchema.optional(),
  nightPalette: paletteSchema.optional(),
  skinMaterial: z.string().optional(),
  setDesign: z.string().optional(),
  lighting: z.string().optional(),
  styleAnchor: z.string().optional(),
});

const coreConflictItemSchema = z.object({
  dimension: z.string().min(1),
  content: z.string().min(1),
});

const sceneSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  environmentTimeMood: z.string().min(1),
  imagePrompt: z.string().min(1),
  negativePrompt: z.string().default(""),
  colorBlock: colorBlockSchema,
  description: z.string().optional(),
  foreground: z.string().optional(),
  atmosphere: z.string().optional(),
  compositionSpec: z.string().optional(),
  visualStyleTag: z.string().optional(),
});

const characterSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  role: z.string().min(1),
  appearance: z.string().min(1),
  personality: z.string().default(""),
  imagePrompt: z.string().min(1),
  description: z.string().optional(),
  clothing: z.string().optional(),
  traits: z.string().optional(),
  compositionSpec: z.string().optional(),
  visualStyleTag: z.string().optional(),
  /** 可选声线说明/参考 · Step2 首次 TTS 可绑定 */
  voiceRefNote: z.string().optional(),
});

const shotAnalysisSchema = z.object({
  timing: z
    .object({
      startTimeSec: z.number().nonnegative(),
      endTimeSec: z.number().positive(),
    })
    .optional(),
  cut: z
    .object({
      transition: z.string().optional(),
      detail: z.string().optional(),
    })
    .optional(),
  cinematography: z
    .object({
      cameraAngle: z.string().optional(),
      focalLength: z.string().optional(),
      composition: z.string().optional(),
    })
    .optional(),
  blocking: z
    .object({
      subjectBlocking: z.string().optional(),
      sightDirection: z.string().optional(),
      foreMidBackLayer: z.string().optional(),
      sceneEnvironment: z.string().optional(),
      dynamicProps: z.string().optional(),
    })
    .optional(),
  look: z
    .object({
      lightingSetup: z.string().optional(),
      toneContrast: z.string().optional(),
    })
    .optional(),
  narrative: z
    .object({
      function: z.string().optional(),
      rhythmWeight: z.string().optional(),
      visualMetaphor: z.string().optional(),
    })
    .optional(),
  audioInfo: z
    .object({
      scriptSubtitle: z.string().optional(),
      vocalEmotion: z.string().optional(),
      ambientSound: z.string().optional(),
      fxAndBgm: z.string().optional(),
    })
    .optional(),
  analysisDraftPrompt: z.string().optional(),
});

const shotSchema = z.object({
  index: z.number().int().positive(),
  shotSize: z.string().optional(),
  cameraMove: z.string().optional(),
  /** Pass1 必填 · shot_prompts patch 可省略 */
  sceneDescription: z.string().optional(),
  dialogue: z.string().default("—"),
  durationSec: z.number().positive().optional(),
  /** v1 Pass2 分镜图 · v2 用 frameImagePrompt */
  imagePrompt: z.string().optional(),
  videoPrompt: z.string().optional(),
  /** v2 Pass2 分镜图 */
  frameImagePrompt: z.string().optional(),
  audioNote: z.string().default(""),
  sfxNote: z.string().optional(),
  propIds: z.array(z.string()).optional(),
  sceneId: z.string().optional(),
  characterIds: z.array(z.string()).optional(),
  colorBlock: colorBlockSchema,
  lighting: z.string().optional(),
  analysis: shotAnalysisSchema.optional(),
});

const handoffSchema = z.object({
  index: z.number().int().positive(),
  item: z.string().min(1),
  owner: z.string().min(1),
  note: z.string().default(""),
});

const propSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  imagePrompt: z.string().optional(),
  traits: z.string().optional(),
  compositionSpec: z.string().optional(),
  visualStyleTag: z.string().optional(),
});

const moodSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
});

const audioSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  frameIndex: z.number().int().positive().optional(),
});

const schemaVersionLiteral = z.union([
  z.literal(PRO2_PRODUCTION_SCRIPT_SCHEMA_VERSION_LEGACY),
  z.literal(PRO2_PRODUCTION_SCRIPT_SCHEMA_VERSION_V2),
  z.literal(PRO2_PRODUCTION_SCRIPT_SCHEMA_VERSION),
]);

export const pro2ProductionScriptSchema = z.object({
  schemaVersion: schemaVersionLiteral,
  meta: metaSchema.optional(),
  visualStyle: visualStyleSchema.optional(),
  coreConflict: z.array(coreConflictItemSchema).optional(),
  scenes: z.array(sceneSchema).optional(),
  characters: z.array(characterSchema).optional(),
  shots: z.array(shotSchema).optional(),
  handoff: z.array(handoffSchema).optional(),
  props: z.array(propSchema).optional(),
  moods: z.array(moodSchema).optional(),
  audios: z.array(audioSchema).optional(),
});

export type Pro2ProductionScript = z.infer<typeof pro2ProductionScriptSchema>;
export type Pro2ShotAnalysis = z.infer<typeof shotAnalysisSchema>;

export const pro2ProductionScriptPatchBodySchema = z.object({
  meta: metaSchema.optional(),
  visualStyle: visualStyleSchema.optional(),
  coreConflict: z.array(coreConflictItemSchema).optional(),
  scenes: z.array(sceneSchema).optional(),
  characters: z.array(characterSchema).optional(),
  shots: z.array(shotSchema).optional(),
  handoff: z.array(handoffSchema).optional(),
  props: z.array(propSchema).optional(),
  moods: z.array(moodSchema).optional(),
  audios: z.array(audioSchema).optional(),
});

export type Pro2ProductionScriptPatchBody = z.infer<
  typeof pro2ProductionScriptPatchBodySchema
>;

export function isPro2ProductionScriptV2(
  schemaVersion: number | undefined,
): boolean {
  return (
    schemaVersion === PRO2_PRODUCTION_SCRIPT_SCHEMA_VERSION_V2 ||
    schemaVersion === PRO2_PRODUCTION_SCRIPT_SCHEMA_VERSION
  );
}

export function resolvePro2PackProfile(
  meta?: { packProfile?: string } | null,
): Pro2PackProfile {
  return meta?.packProfile === "industrial" ? "industrial" : "director";
}

export function resolvePro2ScriptSource(
  meta?: { source?: string } | null,
): Pro2ScriptSource {
  return meta?.source === "film_pull" ? "film_pull" : "creative";
}

function isPro2AnalysisPlaceholder(value: string | undefined | null): boolean {
  const t = value?.trim() ?? "";
  return !t || t === "无" || t === "—" || t === "-";
}

/** Hub 展示/渲染 · 旧节点缺 schemaVersion 时按 v2 字段推断 */
export function ensurePro2ProductionScriptSchemaVersion(
  script: Pro2ProductionScript,
): Pro2ProductionScript {
  if (isPro2ProductionScriptV2(script.schemaVersion)) return script;
  const hasV2Shots = (script.shots ?? []).some(
    (s) =>
      Boolean(s.lighting?.trim()) ||
      Boolean(s.sfxNote?.trim()) ||
      Boolean(s.propIds?.length) ||
      Boolean(s.sceneId?.trim()),
  );
  if (
    hasV2Shots ||
    (script.props?.length ?? 0) > 0 ||
    (script.scenes?.length ?? 0) > 0
  ) {
    return {
      ...script,
      schemaVersion: PRO2_PRODUCTION_SCRIPT_SCHEMA_VERSION,
    };
  }
  return script;
}

function validateProTierShotsV1(
  shots: z.infer<typeof shotSchema>[] | undefined,
  tier: Pro2ProductionScriptTier,
  ctx: z.RefinementCtx,
  pathPrefix: (string | number)[],
): void {
  if (!shots?.length) return;
  if (tier === "standard") {
    for (const [i, shot] of shots.entries()) {
      if (!shot.imagePrompt?.trim() && !shot.videoPrompt?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "standard 档分镜须含 imagePrompt 或 videoPrompt",
          path: [...pathPrefix, i],
        });
      }
    }
    return;
  }
  for (const [i, shot] of shots.entries()) {
    const missing: string[] = [];
    if (!shot.shotSize?.trim()) missing.push("shotSize");
    if (!shot.cameraMove?.trim()) missing.push("cameraMove");
    if (!shot.durationSec || shot.durationSec <= 0) missing.push("durationSec");
    if (!shot.imagePrompt?.trim()) missing.push("imagePrompt");
    if (!shot.videoPrompt?.trim()) missing.push("videoPrompt");
    if (!shot.audioNote?.trim()) missing.push("audioNote");
    if (missing.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `pro/fine 档分镜 ${shot.index} 缺少必填字段：${missing.join(", ")}`,
        path: [...pathPrefix, i],
      });
    }
  }
}

function validateProTierShotsV2Pass1(
  shots: z.infer<typeof shotSchema>[] | undefined,
  tier: Pro2ProductionScriptTier,
  ctx: z.RefinementCtx,
  pathPrefix: (string | number)[],
): void {
  if (!shots?.length) return;
  if (tier === "standard") {
    for (const [i, shot] of shots.entries()) {
      if (!shot.sceneDescription?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "standard 档分镜须含 sceneDescription",
          path: [...pathPrefix, i],
        });
      }
    }
    return;
  }
  for (const [i, shot] of shots.entries()) {
    const missing: string[] = [];
    if (!shot.sceneDescription?.trim()) missing.push("sceneDescription");
    if (!shot.shotSize?.trim()) missing.push("shotSize");
    if (!shot.lighting?.trim()) missing.push("lighting");
    if (!shot.cameraMove?.trim() || shot.cameraMove.trim().length < 12) {
      missing.push("cameraMove");
    }
    if (!shot.durationSec || shot.durationSec <= 0) missing.push("durationSec");
    if (!shot.sfxNote?.trim()) missing.push("sfxNote");
    if (!shot.audioNote?.trim()) missing.push("audioNote");
    if (missing.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `v2 pro 档分镜 ${shot.index} 缺少必填字段：${missing.join(", ")}`,
        path: [...pathPrefix, i],
      });
    }
  }
}

export type ShotPromptPolishMode = "frame" | "video" | "both";

function inferShotPromptPolishMode(
  shot: z.infer<typeof shotSchema>,
): ShotPromptPolishMode {
  const frame =
    shot.frameImagePrompt?.trim() || shot.imagePrompt?.trim() || "";
  const video = shot.videoPrompt?.trim() || "";
  if (frame && !video) return "frame";
  if (video && !frame) return "video";
  return "both";
}

export function listShotPromptsPass2Issues(
  shots: z.infer<typeof shotSchema>[] | undefined,
  mode: ShotPromptPolishMode = "both",
): string[] {
  if (!shots?.length) return ["shot_prompts step 须含 shots"];
  const issues: string[] = [];
  for (const shot of shots) {
    const effectiveMode =
      mode === "both" ? inferShotPromptPolishMode(shot) : mode;
    const frame =
      shot.frameImagePrompt?.trim() || shot.imagePrompt?.trim() || "";
    const video = shot.videoPrompt?.trim() || "";
    const missing: string[] = [];
    if (effectiveMode === "frame" || effectiveMode === "both") {
      if (!frame) missing.push("frameImagePrompt");
    }
    if (effectiveMode === "video" || effectiveMode === "both") {
      if (!video) missing.push("videoPrompt");
    }
    if (missing.length) {
      issues.push(`分镜 ${shot.index} Pass2 缺少：${missing.join(", ")}`);
    }
  }
  return issues;
}

function validateShotPromptsPass2(
  shots: z.infer<typeof shotSchema>[] | undefined,
  ctx: z.RefinementCtx,
  pathPrefix: (string | number)[],
  mode: ShotPromptPolishMode = "both",
): void {
  if (!shots?.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "shot_prompts step 须含 shots",
      path: ["patch", "shots"],
    });
    return;
  }
  for (const [i, shot] of shots.entries()) {
    const effectiveMode =
      mode === "both" ? inferShotPromptPolishMode(shot) : mode;
    const frame =
      shot.frameImagePrompt?.trim() || shot.imagePrompt?.trim() || "";
    const video = shot.videoPrompt?.trim() || "";
    const missing: string[] = [];
    if (effectiveMode === "frame" || effectiveMode === "both") {
      if (!frame) missing.push("frameImagePrompt");
    }
    if (effectiveMode === "video" || effectiveMode === "both") {
      if (!video) missing.push("videoPrompt");
    }
    if (missing.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `分镜 ${shot.index} Pass2 缺少：${missing.join(", ")}`,
        path: [...pathPrefix, i],
      });
    }
  }
}

function validateProTierShots(
  shots: z.infer<typeof shotSchema>[] | undefined,
  tier: Pro2ProductionScriptTier,
  schemaVersion: Pro2ProductionScriptSchemaVersion,
  step: Pro2ProductionScriptStep,
  ctx: z.RefinementCtx,
  pathPrefix: (string | number)[],
): void {
  if (step === "shot_prompts") {
    validateShotPromptsPass2(shots, ctx, pathPrefix);
    return;
  }
  if (isPro2ProductionScriptV2(schemaVersion)) {
    validateProTierShotsV2Pass1(shots, tier, ctx, pathPrefix);
    return;
  }
  validateProTierShotsV1(shots, tier, ctx, pathPrefix);
}

function validateFullPackBlocks(
  patch: Pro2ProductionScriptPatchBody,
  ctx: z.RefinementCtx,
): void {
  for (const issue of listPro2FullPackPatchIssues(patch)) {
    const key = issue.replace(/^full_pack 须含非空 /, "");
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: issue,
      path: ["patch", key],
    });
  }
}

/** Hub outline / full_pack 校验 · 返回可读错误列表 */
export function listPro2FullPackPatchIssues(
  patch: Pro2ProductionScriptPatchBody,
): string[] {
  const source = resolvePro2ScriptSource(patch.meta);
  const required: Array<keyof Pro2ProductionScriptPatchBody> =
    source === "film_pull"
      ? ["shots"]
      : [
          "visualStyle",
          "coreConflict",
          "scenes",
          "characters",
          "shots",
          "handoff",
        ];
  const issues: string[] = [];
  for (const key of required) {
    const val = patch[key];
    if (val == null || (Array.isArray(val) && val.length === 0)) {
      issues.push(`full_pack 须含非空 ${key}`);
    }
  }
  return issues;
}

export function listPro2CreativeDurationIssues(
  shots: Pro2ProductionScriptPatchBody["shots"] | undefined,
  source: Pro2ScriptSource = "creative",
  _packProfile: Pro2PackProfile = "director",
): string[] {
  // 简版 / 专业版 creative 均强制；仅 film_pull 跟片时长豁免
  if (source === "film_pull") return [];
  if (!shots?.length) return [];
  const issues: string[] = [];
  if (shots.length < 12 || shots.length > 18) {
    issues.push(`creative 须 12–18 镜，当前 ${shots.length} 镜`);
  }
  for (const s of shots) {
    const d = s.durationSec ?? 0;
    if (d < 10 || d > 15 || !Number.isInteger(d)) {
      issues.push(
        `分镜 ${s.index} durationSec 须为 10–15 整数，当前 ${s.durationSec}`,
      );
      break;
    }
  }
  const total = shots.reduce((sum, s) => sum + (s.durationSec ?? 0), 0);
  if (total < 175 || total > 185) {
    issues.push(`creative 总时长须 175–185 秒，当前 ${total}`);
  }
  return issues;
}

/**
 * creative · 镜数已在 12–18 时，把各镜 durationSec 钳到 10–15 并微调合计至 175–185。
 * 镜数不对则原样返回（仍走校验失败 → 提示词重试）。
 */
export function normalizePro2CreativeShotDurations<
  T extends { durationSec?: number },
>(shots: T[], source: Pro2ScriptSource = "creative"): T[] {
  if (source === "film_pull") return shots;
  if (shots.length < 12 || shots.length > 18) return shots;

  const next = shots.map((s) => {
    let d = Number(s.durationSec);
    if (!Number.isFinite(d) || d <= 0) d = 12;
    d = Math.round(d);
    if (d < 10) d = 10;
    if (d > 15) d = 15;
    return { ...s, durationSec: d };
  });

  let total = next.reduce((sum, s) => sum + (s.durationSec ?? 0), 0);
  let guard = 0;
  while ((total < 175 || total > 185) && guard < 500) {
    guard += 1;
    if (total < 175) {
      const i = next.findIndex((s) => (s.durationSec ?? 0) < 15);
      if (i < 0) break;
      const cur = next[i]!;
      next[i] = { ...cur, durationSec: (cur.durationSec ?? 0) + 1 };
      total += 1;
    } else {
      const i = next.findIndex((s) => (s.durationSec ?? 0) > 10);
      if (i < 0) break;
      const cur = next[i]!;
      next[i] = { ...cur, durationSec: (cur.durationSec ?? 0) - 1 };
      total -= 1;
    }
  }
  return next;
}

export function listPro2IndustrialAnalysisIssues(
  shots: Pro2ProductionScriptPatchBody["shots"] | undefined,
  source: Pro2ScriptSource = "creative",
  totalDurationSec?: number,
): string[] {
  if (!shots?.length) return ["industrial 须含 shots"];
  const issues: string[] = [];
  let sceneEmpty = 0;
  for (const [i, shot] of shots.entries()) {
    const label = `分镜 ${shot.index}`;
    const a = shot.analysis;
    if (!a) {
      issues.push(`${label} 缺少 analysis`);
      continue;
    }
    if (isPro2AnalysisPlaceholder(a.cinematography?.cameraAngle)) {
      issues.push(`${label} analysis.cinematography.cameraAngle 必填`);
    }
    if (isPro2AnalysisPlaceholder(a.cinematography?.focalLength)) {
      issues.push(`${label} analysis.cinematography.focalLength 必填`);
    }
    if (isPro2AnalysisPlaceholder(a.blocking?.subjectBlocking)) {
      issues.push(`${label} analysis.blocking.subjectBlocking 必填`);
    }
    if (isPro2AnalysisPlaceholder(a.blocking?.foreMidBackLayer)) {
      issues.push(`${label} analysis.blocking.foreMidBackLayer 必填`);
    }
    if (isPro2AnalysisPlaceholder(a.blocking?.sceneEnvironment)) {
      sceneEmpty += 1;
    }
    const isLast = i === shots.length - 1;
    if (
      !isLast &&
      isPro2AnalysisPlaceholder(a.cut?.detail) &&
      (source === "film_pull" || shots.length > 1)
    ) {
      issues.push(`${label} analysis.cut.detail 禁止「无」`);
    }
    if (shot.frameImagePrompt?.trim() || shot.videoPrompt?.trim()) {
      issues.push(`${label} Pass1 禁止 frameImagePrompt / videoPrompt`);
    }
  }
  if (source === "film_pull") {
    if (sceneEmpty > shots.length / 2) {
      issues.push("超过半数镜头的 sceneEnvironment 仍为「无」");
    }
    const timed = shots.filter((s) => s.analysis?.timing);
    if (timed.length === shots.length) {
      for (let i = 1; i < shots.length; i++) {
        const prev = shots[i - 1]!.analysis!.timing!;
        const cur = shots[i]!.analysis!.timing!;
        if (cur.startTimeSec + 0.05 < prev.endTimeSec) {
          issues.push(
            `分镜 ${shots[i]!.index} 入点早于上一镜出点（时间轴须连续）`,
          );
        }
      }
    }
    const sumDur = shots.reduce((sum, s) => sum + (s.durationSec ?? 0), 0);
    if (
      typeof totalDurationSec === "number" &&
      Number.isFinite(totalDurationSec) &&
      Math.abs(sumDur - totalDurationSec) > 0.5
    ) {
      issues.push(
        `film_pull 各镜时长之和 ${sumDur} 须约等于 meta.totalDurationSec ${totalDurationSec}`,
      );
    }
  }
  return issues;
}

/** 开引号：ASCII " · 弯引号 “ · 直角 「 · 双直角 『 */
const PRO2_DIALOGUE_OPEN_Q = `["“「『]`;
/** 闭引号：ASCII " · 弯引号 ” · 直角 」 · 双直角 』 */
const PRO2_DIALOGUE_CLOSE_Q = `["”」』]`;

const PRO2_DIALOGUE_FORMAT_LENIENT_RE = new RegExp(
  `^(?:[^（(：:\\n]+(?:[（(][^）)]+[）)])?\\s*[：:]\\s*${PRO2_DIALOGUE_OPEN_Q}[^"“”「」『』]+${PRO2_DIALOGUE_CLOSE_Q}\\s*)+$`,
  "u",
);

/** 兼容校验 · 须含角色名 + 引号台词；情绪括号可省略（coerce 后补） */
const PRO2_DIALOGUE_FORMAT_RE = PRO2_DIALOGUE_FORMAT_LENIENT_RE;

/** 仅字形归一：弯引号 → ASCII；不改台词正文 */
function normalizePro2DialogueQuotes(text: string): string {
  return text
    .replace(/[\u201C\u201D\u300E\u300F]/g, '"') // “ ” 『 』
    .replace(/\u2018|\u2019/g, "'");
}

function coerceSinglePro2DialogueSegment(segment: string): string {
  const t = normalizePro2DialogueQuotes(segment.trim());
  if (!t || t === "—" || t === "-") return "—";
  if (/[（(][^）)]+[）)]\s*[：:]/.test(t)) return t;
  const m = t.match(
    /^([\u4e00-\u9fa5A-Za-z0-9·]+(?:内心OS)?)\s*[：:]\s*(["「].+[」"])$/u,
  );
  if (m) return `${m[1]!}（—）：${m[2]!}`;
  return t;
}

/** LLM 常写弯引号 /「角色："台词"」/ 多句连写；解析前只做格式收拢，不编造台词 */
export function coercePro2DialogueForParse(value: unknown): unknown {
  if (typeof value !== "string") return value;
  let t = normalizePro2DialogueQuotes(value.trim());
  if (!t || t === "—" || t === "-") return "—";
  // 「角色说：」→「角色：」
  t = t.replace(
    /([\u4e00-\u9fa5A-Za-z0-9·]+)(内心OS)?(说|道|讲)\s*[：:]/gu,
    "$1$2：",
  );
  if (PRO2_DIALOGUE_FORMAT_LENIENT_RE.test(t)) return t;

  const segments = t
    .split(/(?=[\u4e00-\u9fa5A-Za-z0-9·]+(?:内心OS)?\s*[：:])/u)
    .map((s) => s.trim())
    .filter(Boolean);
  if (segments.length > 1) {
    const joined = segments.map(coerceSinglePro2DialogueSegment).join("");
    if (PRO2_DIALOGUE_FORMAT_LENIENT_RE.test(joined)) return joined;
  }
  const single = coerceSinglePro2DialogueSegment(t);
  if (PRO2_DIALOGUE_FORMAT_LENIENT_RE.test(single)) return single;
  return t;
}

function countPro2TraitItems(traits?: string): number {
  const t = traits?.trim() ?? "";
  if (!t) return 0;
  const numbered = t.match(/[①②③④⑤⑥⑦⑧⑨⑩]/gu);
  if (numbered && numbered.length >= 3) return numbered.length;
  return t.split(/[，,、；;\n]/u).map((s) => s.trim()).filter(Boolean).length;
}

function imagePromptHasRequiredBlocks(prompt?: string): boolean {
  const p = prompt?.trim() ?? "";
  if (!p) return false;
  return p.includes("构图规范") && /\[视觉风格：/.test(p);
}

function characterHasSignatureAction(c: {
  appearance?: string;
  traits?: string;
  description?: string;
}): boolean {
  const blob = [c.appearance, c.traits, c.description].filter(Boolean).join("\n");
  return /标志性动作/u.test(blob);
}

/** characters[] 语义校验 · JSON-only v13 */
export function listPro2CharacterPatchIssues(
  characters: Pro2ProductionScriptPatchBody["characters"],
): string[] {
  const issues: string[] = [];
  if (!characters?.length) return issues;
  for (const c of characters) {
    const label = c.name?.trim() || c.id;
    if (characterHasSignatureAction(c)) {
      issues.push(`角色 ${label} 禁止含「标志性动作」，须写 traits（≥3 项固定特征）`);
    }
    const traitText = c.traits?.trim() ?? "";
    const appearanceTraits = /③\s*特征[：:]/u.test(c.appearance ?? "")
      ? c.appearance
      : "";
    const traitCount = Math.max(
      countPro2TraitItems(traitText),
      countPro2TraitItems(appearanceTraits ?? ""),
    );
    if (traitCount < 3) {
      issues.push(`角色 ${label} traits 须 ≥3 项（或 appearance 含 ③ 特征）`);
    }
    if (!imagePromptHasRequiredBlocks(c.imagePrompt)) {
      issues.push(`角色 ${label} imagePrompt 须含「构图规范」与 [视觉风格：…]`);
    }
  }
  return issues;
}

/** shots[].dialogue 格式校验 */
export function listPro2ShotDialogueIssues(
  shots: Pro2ProductionScriptPatchBody["shots"],
): string[] {
  const issues: string[] = [];
  if (!shots?.length) return issues;
  for (const s of shots) {
    const d = coercePro2DialogueForParse(s.dialogue);
    const dialogue = typeof d === "string" ? d : (s.dialogue ?? "").trim();
    if (!dialogue || dialogue === "—" || dialogue === "-") continue;
    if (!PRO2_DIALOGUE_FORMAT_LENIENT_RE.test(dialogue)) {
      issues.push(
        `镜 ${s.index} 对白须为 角色名（情绪/语气）："台词" 格式，无对白写「—」`,
      );
    }
  }
  return issues;
}

function listPro2AssetImagePromptIssues(
  patch: Pro2ProductionScriptPatchBody,
): string[] {
  const issues: string[] = [];
  for (const s of patch.scenes ?? []) {
    if (!imagePromptHasRequiredBlocks(s.imagePrompt)) {
      issues.push(`场景 ${s.name} imagePrompt 须含「构图规范」与 [视觉风格：…]`);
    }
  }
  for (const p of patch.props ?? []) {
    // 与 scenes 一致：props 必须带完整 imagePrompt（不得省略）
    if (!imagePromptHasRequiredBlocks(p.imagePrompt)) {
      issues.push(`道具 ${p.name} imagePrompt 须含「构图规范」与 [视觉风格：…]`);
    }
  }
  return issues;
}

const SCENE_TIME_MOOD_KEYWORDS = [
  "深夜",
  "白日",
  "黄昏",
  "日内",
  "夜间",
  "清晨",
  "入夜",
  "凌晨",
  "正午",
  "傍晚",
  "白天",
  "夜晚",
];

/** lighting 是否与 sceneId 绑定（多场景时强制含 canonical name） */
function shotLightingMatchesSceneBinding(
  lighting: string,
  scene: { name: string; environmentTimeMood?: string },
  multiScene: boolean,
): boolean {
  const lit = lighting.trim();
  if (!lit) return false;
  const name = scene.name.trim();
  if (multiScene) return name.length >= 2 && lit.includes(name);
  if (name.length >= 2 && lit.includes(name)) return true;
  const mood = scene.environmentTimeMood?.trim() ?? "";
  if (mood && lit.includes(mood)) return true;
  for (const token of mood.split(/[,，、]/).map((t) => t.trim()).filter(Boolean)) {
    if (token.length >= 2 && lit.includes(token)) return true;
  }
  for (const kw of SCENE_TIME_MOOD_KEYWORDS) {
    if (mood.includes(kw) && lit.includes(kw)) return true;
  }
  return false;
}

/** shots[] 实体关联校验 · sceneId / propIds / characterIds */
export function listPro2ShotEntityLinkIssues(
  patch: Pro2ProductionScriptPatchBody,
): string[] {
  const issues: string[] = [];
  const shots = patch.shots;
  if (!shots?.length) return issues;

  const isV2Pass1 = shots.some(
    (s) =>
      Boolean(s.lighting?.trim()) ||
      Boolean(s.sfxNote?.trim()) ||
      Boolean(s.propIds?.length) ||
      (patch.props?.length ?? 0) > 0,
  );
  if (!isV2Pass1) return issues;

  const scenes = patch.scenes ?? [];
  const props = patch.props ?? [];
  const characters = patch.characters ?? [];
  const sceneIdSet = new Set(scenes.map((s) => s.id));
  const propIdSet = new Set(props.map((p) => p.id));
  const charIdSet = new Set(characters.map((c) => c.id));

  for (const shot of shots) {
    const label = `镜 ${shot.index}`;
    if (scenes.length > 0 && !shot.sceneId?.trim()) {
      issues.push(`${label} 缺少 sceneId（须引用 scenes[].id）`);
    }
    if (shot.sceneId?.trim() && scenes.length > 0 && !sceneIdSet.has(shot.sceneId)) {
      issues.push(`${label} sceneId=${shot.sceneId} 不存在于 scenes[]`);
    }
    if (shot.sceneId?.trim() && scenes.length > 0) {
      const scene = scenes.find((s) => s.id === shot.sceneId);
      const lighting = shot.lighting?.trim() ?? "";
      if (scene && lighting && !shotLightingMatchesSceneBinding(lighting, scene, scenes.length >= 2)) {
        if (scenes.length >= 2) {
          issues.push(
            `${label} lighting 须含场景 canonical name「${scene.name}」（多场景剧本须与 sceneId 一致）`,
          );
        } else {
          issues.push(
            `${label} lighting 须含场景 name 或 environmentTimeMood 关键词（与 sceneId 一致）`,
          );
        }
      }
    }
    for (const id of shot.characterIds ?? []) {
      if (characters.length > 0 && !charIdSet.has(id)) {
        issues.push(`${label} characterIds 含无效 id ${id}`);
      }
    }
    for (const id of shot.propIds ?? []) {
      if (props.length > 0 && !propIdSet.has(id)) {
        const normalized = id.replace(/_/g, "-");
        const bySlug = props.find((p) => p.id === normalized || p.id === id);
        if (!bySlug) {
          issues.push(`${label} propIds 含无效 id ${id}`);
        }
      }
    }
    const dialogue = (shot.dialogue ?? "").trim();
    if (
      dialogue &&
      dialogue !== "—" &&
      dialogue !== "-" &&
      characters.length > 0 &&
      !(shot.characterIds?.length)
    ) {
      issues.push(`${label} 有对白但缺少 characterIds`);
    }
    const desc = shot.sceneDescription ?? "";
    if (props.length > 0 && !(shot.propIds?.length)) {
      for (const p of props) {
        const name = p.name?.trim();
        if (name && desc.includes(name)) {
          issues.push(`${label} 画面描述含道具「${name}」但 propIds 为空`);
          break;
        }
      }
    }
  }

  if (scenes.length >= 2 && shots.length > 1) {
    const boundIds = shots.map((s) => s.sceneId?.trim()).filter(Boolean);
    if (boundIds.length === shots.length && new Set(boundIds).size === 1) {
      issues.push(
        `多场景剧本（${scenes.length} 个场景）禁止全片 ${shots.length} 镜共用同一 sceneId=${boundIds[0]}`,
      );
    }
  }

  return issues;
}

/** full_pack / character / storyboard 语义校验汇总 */
export function listPro2SemanticPatchIssues(
  patch: Pro2ProductionScriptPatchBody,
  step: Pro2ProductionScriptStep,
): string[] {
  const issues: string[] = [];
  const source = resolvePro2ScriptSource(patch.meta);
  const profile = resolvePro2PackProfile(patch.meta);
  if (
    source !== "film_pull" &&
    (step === "full_pack" || step === "character" || step === "outline")
  ) {
    issues.push(...listPro2CharacterPatchIssues(patch.characters));
  }
  if (step === "full_pack" || step === "storyboard") {
    issues.push(...listPro2ShotDialogueIssues(patch.shots));
    if (source !== "film_pull") {
      issues.push(...listPro2ShotEntityLinkIssues(patch));
    }
    if (step === "full_pack" || step === "storyboard") {
      issues.push(
        ...listPro2CreativeDurationIssues(patch.shots, source, profile),
      );
    }
    if (profile === "industrial") {
      issues.push(
        ...listPro2IndustrialAnalysisIssues(
          patch.shots,
          source,
          patch.meta?.totalDurationSec,
        ),
      );
    }
  }
  if (
    source !== "film_pull" &&
    (step === "full_pack" || step === "scene")
  ) {
    issues.push(...listPro2AssetImagePromptIssues(patch));
  }
  return issues;
}

function validateSemanticPatchBody(
  patch: Pro2ProductionScriptPatchBody,
  step: Pro2ProductionScriptStep,
  ctx: z.RefinementCtx,
): void {
  for (const issue of listPro2SemanticPatchIssues(patch, step)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: issue,
      path: ["patch"],
    });
  }
}

export const pro2ProductionScriptPatchSchema = z
  .object({
    schemaVersion: schemaVersionLiteral,
    tier: z.enum(PRO2_PRODUCTION_SCRIPT_TIERS).default("pro"),
    step: z.enum(PRO2_PRODUCTION_SCRIPT_STEPS),
    patch: pro2ProductionScriptPatchBodySchema,
  })
  .superRefine((val, ctx) => {
    const { tier, step, patch, schemaVersion } = val;

    if (step === "full_pack") {
      validateFullPackBlocks(patch, ctx);
      validateSemanticPatchBody(patch, step, ctx);
    }

    if (step === "character") {
      validateSemanticPatchBody(patch, step, ctx);
    }

    if (step === "scene") {
      validateSemanticPatchBody(patch, step, ctx);
    }

    if (step === "storyboard") {
      validateSemanticPatchBody(patch, step, ctx);
    }

    if (
      (step === "full_pack" || step === "outline") &&
      (tier === "pro" || tier === "fine")
    ) {
      if (!patch.visualStyle?.worldBackground?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "pro/fine 档 outline 须含 visualStyle.worldBackground",
          path: ["patch", "visualStyle", "worldBackground"],
        });
      }
      if (!patch.visualStyle?.era?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "pro/fine 档 outline 须含 visualStyle.era",
          path: ["patch", "visualStyle", "era"],
        });
      }
    }

    if (
      step === "full_pack" ||
      step === "storyboard" ||
      step === "shot_prompts"
    ) {
      validateProTierShots(
        patch.shots,
        tier,
        schemaVersion,
        step,
        ctx,
        ["patch", "shots"],
      );
    }

    if (step === "character" && (!patch.characters || patch.characters.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "character step 须含 characters",
        path: ["patch", "characters"],
      });
    }

    if (step === "scene" && (!patch.scenes || patch.scenes.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "scene step 须含 scenes",
        path: ["patch", "scenes"],
      });
    }

    if (step === "storyboard" && (!patch.shots || patch.shots.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "storyboard step 须含 shots",
        path: ["patch", "shots"],
      });
    }
  });

export type Pro2ProductionScriptPatch = z.infer<
  typeof pro2ProductionScriptPatchSchema
>;

/** 合并瘦 patch 至已有胖结构 */
export function mergeProductionScriptPatch(
  base: Pro2ProductionScript | undefined,
  envelope: Pro2ProductionScriptPatch,
): Pro2ProductionScript {
  const prev = base ?? {
    schemaVersion: envelope.schemaVersion ?? PRO2_PRODUCTION_SCRIPT_SCHEMA_VERSION,
  };
  const { patch } = envelope;
  return {
    schemaVersion: envelope.schemaVersion ?? prev.schemaVersion,
    meta: patch.meta ?? prev.meta,
    visualStyle: patch.visualStyle ?? prev.visualStyle,
    coreConflict: patch.coreConflict ?? prev.coreConflict,
    scenes: patch.scenes ?? prev.scenes,
    characters: patch.characters ?? prev.characters,
    shots: mergeShotsPatch(prev.shots, patch.shots),
    handoff: patch.handoff ?? prev.handoff,
    props: patch.props ?? prev.props,
    moods: patch.moods ?? prev.moods,
    audios: patch.audios ?? prev.audios,
  };
}

function mergeShotsPatch(
  prev: Pro2ProductionScript["shots"],
  incoming: Pro2ProductionScript["shots"],
): Pro2ProductionScript["shots"] {
  if (!incoming?.length) return prev;
  if (!prev?.length) return incoming;
  const byIndex = new Map(prev.map((s) => [s.index, s] as const));
  for (const shot of incoming) {
    const old = byIndex.get(shot.index);
    byIndex.set(shot.index, old ? { ...old, ...shot } : shot);
  }
  return [...byIndex.values()].sort((a, b) => a.index - b.index);
}

/** v2 分镜图 prompt：优先 frameImagePrompt，回退 v1 imagePrompt */
export function resolvePro2ShotFrameImagePrompt(shot: {
  frameImagePrompt?: string;
  imagePrompt?: string;
}): string {
  return shot.frameImagePrompt?.trim() || shot.imagePrompt?.trim() || "";
}
