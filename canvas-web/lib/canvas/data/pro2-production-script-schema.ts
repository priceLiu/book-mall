/**
 * Pro2 制作包 · 结构化 JSON 契约（canvas-web 真源）
 * book-mall/lib/canvas/data/pro2-production-script-schema.ts 须保持同步
 */
import { z } from "zod";

export const PRO2_PRODUCTION_SCRIPT_SCHEMA_VERSION = 2 as const;
export const PRO2_PRODUCTION_SCRIPT_SCHEMA_VERSION_LEGACY = 1 as const;
export const PRO2_PRODUCTION_SCRIPT_SCHEMA_VERSIONS = [1, 2] as const;
export type Pro2ProductionScriptSchemaVersion =
  (typeof PRO2_PRODUCTION_SCRIPT_SCHEMA_VERSIONS)[number];

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

const colorBlockSchema = z.object({
  primary: z.string().min(1),
  secondary: z.string().optional(),
  highlight: z.string().optional(),
  shadow: z.string().optional(),
  notes: z.string().optional(),
});

const paletteSchema = z.object({
  primary: z.string().optional(),
  highlight: z.string().optional(),
  shadow: z.string().optional(),
});

const metaSchema = z.object({
  title: z.string().optional(),
  synopsis: z.string().optional(),
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
  colorBlock: colorBlockSchema.optional(),
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
});

const shotSchema = z.object({
  index: z.number().int().positive(),
  shotSize: z.string().optional(),
  cameraMove: z.string().optional(),
  sceneDescription: z.string().min(1),
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
  colorBlock: colorBlockSchema.optional(),
  lighting: z.string().optional(),
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
  return schemaVersion === PRO2_PRODUCTION_SCRIPT_SCHEMA_VERSION;
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
      Boolean(s.propIds?.length),
  );
  if (hasV2Shots || (script.props?.length ?? 0) > 0) {
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
    if (!shot.shotSize?.trim()) missing.push("shotSize");
    if (!shot.lighting?.trim()) missing.push("lighting");
    if (!shot.cameraMove?.trim() || shot.cameraMove.trim().length < 8) {
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

function validateShotPromptsPass2(
  shots: z.infer<typeof shotSchema>[] | undefined,
  ctx: z.RefinementCtx,
  pathPrefix: (string | number)[],
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
    const frame =
      shot.frameImagePrompt?.trim() || shot.imagePrompt?.trim() || "";
    const video = shot.videoPrompt?.trim() || "";
    const missing: string[] = [];
    if (!frame) missing.push("frameImagePrompt");
    if (!video) missing.push("videoPrompt");
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
  const required: Array<keyof Pro2ProductionScriptPatchBody> = [
    "visualStyle",
    "coreConflict",
    "scenes",
    "characters",
    "shots",
    "handoff",
  ];
  for (const key of required) {
    const val = patch[key];
    if (val == null || (Array.isArray(val) && val.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `full_pack 须含非空 ${key}`,
        path: ["patch", key],
      });
    }
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
