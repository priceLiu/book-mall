/**
 * Pro2 制作包 · 结构化 JSON 契约（canvas-web 真源）
 * book-mall/lib/canvas/data/pro2-production-script-schema.ts 须保持同步
 */
import { z } from "zod";

export const PRO2_PRODUCTION_SCRIPT_SCHEMA_VERSION = 1 as const;

export const PRO2_PRODUCTION_SCRIPT_TIERS = ["standard", "pro", "fine"] as const;
export type Pro2ProductionScriptTier = (typeof PRO2_PRODUCTION_SCRIPT_TIERS)[number];

export const PRO2_PRODUCTION_SCRIPT_STEPS = [
  "full_pack",
  "outline",
  "character",
  "scene",
  "storyboard",
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
});

const characterSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  role: z.string().min(1),
  appearance: z.string().min(1),
  personality: z.string().default(""),
  imagePrompt: z.string().min(1),
});

const shotSchema = z.object({
  index: z.number().int().positive(),
  shotSize: z.string().optional(),
  cameraMove: z.string().optional(),
  sceneDescription: z.string().min(1),
  dialogue: z.string().default("—"),
  durationSec: z.number().positive().optional(),
  imagePrompt: z.string().optional(),
  videoPrompt: z.string().optional(),
  audioNote: z.string().default(""),
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

export const pro2ProductionScriptSchema = z.object({
  schemaVersion: z.literal(PRO2_PRODUCTION_SCRIPT_SCHEMA_VERSION),
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

function validateProTierShots(
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
    schemaVersion: z.literal(PRO2_PRODUCTION_SCRIPT_SCHEMA_VERSION),
    tier: z.enum(PRO2_PRODUCTION_SCRIPT_TIERS).default("pro"),
    step: z.enum(PRO2_PRODUCTION_SCRIPT_STEPS),
    patch: pro2ProductionScriptPatchBodySchema,
  })
  .superRefine((val, ctx) => {
    const { tier, step, patch } = val;

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

    if (step === "full_pack" || step === "storyboard") {
      validateProTierShots(patch.shots, tier, ctx, ["patch", "shots"]);
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
  const prev = base ?? { schemaVersion: PRO2_PRODUCTION_SCRIPT_SCHEMA_VERSION };
  const { patch } = envelope;
  return {
    schemaVersion: PRO2_PRODUCTION_SCRIPT_SCHEMA_VERSION,
    meta: patch.meta ?? prev.meta,
    visualStyle: patch.visualStyle ?? prev.visualStyle,
    coreConflict: patch.coreConflict ?? prev.coreConflict,
    scenes: patch.scenes ?? prev.scenes,
    characters: patch.characters ?? prev.characters,
    shots: patch.shots ?? prev.shots,
    handoff: patch.handoff ?? prev.handoff,
    props: patch.props ?? prev.props,
    moods: patch.moods ?? prev.moods,
    audios: patch.audios ?? prev.audios,
  };
}
