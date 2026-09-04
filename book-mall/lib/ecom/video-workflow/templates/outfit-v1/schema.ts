import { z } from "zod";

import {
  sceneShotSchema,
  workflowComposeResultSchema,
  workflowMediaInputSchema,
  workflowRefsSchema,
} from "@/lib/ecom/video-workflow/shot-spine";

export const outfitSplitConfigSchema = z.object({
  minSceneDurationSec: z.number().positive().default(2),
  maxSceneDurationSec: z.number().positive().default(4),
});

export const outfitPromptConfigSchema = z.object({
  positivePrompt: z.string().min(1),
  negativePrompt: z.string().default(""),
});

export const outfitVideoConfigSchema = z.object({
  resolution: z.string().default("1080*1920"),
  fps: z.number().positive().default(30),
  aspectRatio: z.enum(["9:16", "16:9"]).default("9:16"),
  actionFidelity: z.string().default("high"),
});

export const outfitGenerateConstraintSchema = z.object({
  keepModelIdentity: z.boolean().default(true),
  keepClothingShape: z.boolean().default(true),
  keepClothingColor: z.boolean().default(true),
  disableBodyDistortion: z.boolean().default(true),
  disableFlicker: z.boolean().default(true),
});

export const outfitSceneSplitPayloadSchema = z.object({
  mediaInput: workflowMediaInputSchema,
  splitConfig: outfitSplitConfigSchema.optional(),
  totalSceneNum: z.number().int().nonnegative(),
  sceneList: z.array(sceneShotSchema).min(1),
});

export const outfitScenesEditedPayloadSchema = z.object({
  sceneList: z.array(sceneShotSchema).min(1),
});

export const outfitRefsLockedPayloadSchema = z.object({
  refs: workflowRefsSchema,
  sceneList: z.array(sceneShotSchema).min(1),
});

export const outfitSceneTaskSchema = z.object({
  sceneId: z.string().min(1),
  keypointsUrl: z.string().optional(),
  previewImageUrl: z.string().optional(),
});

export const outfitShotGeneratePayloadSchema = z.object({
  refs: workflowRefsSchema,
  sceneTaskList: z.array(outfitSceneTaskSchema).min(1),
  videoConfig: outfitVideoConfigSchema.optional(),
  generateConstraint: outfitGenerateConstraintSchema.optional(),
  promptConfig: outfitPromptConfigSchema.optional(),
  sceneResultList: z
    .array(
      z.object({
        sceneId: z.string().min(1),
        sceneVideoUrl: z.string().optional(),
        status: z.enum(["success", "failed", "processing"]),
        failReason: z.string().optional(),
      }),
    )
    .optional(),
});

export const outfitComposePayloadSchema = z.object({
  composeResult: workflowComposeResultSchema,
});

export type OutfitSceneSplitPayload = z.infer<typeof outfitSceneSplitPayloadSchema>;
export type OutfitScenesEditedPayload = z.infer<typeof outfitScenesEditedPayloadSchema>;
export type OutfitRefsLockedPayload = z.infer<typeof outfitRefsLockedPayloadSchema>;
export type OutfitShotGeneratePayload = z.infer<typeof outfitShotGeneratePayloadSchema>;
export type OutfitComposePayload = z.infer<typeof outfitComposePayloadSchema>;

export function parseOutfitPayload(action: string, payload: unknown): unknown | null {
  switch (action) {
    case "scene_split_complete":
      return outfitSceneSplitPayloadSchema.safeParse(payload).success ? payload : null;
    case "scenes_edited":
    case "scene_preview_regenerated":
      return outfitScenesEditedPayloadSchema.safeParse(payload).success ? payload : null;
    case "refs_locked":
      return outfitRefsLockedPayloadSchema.safeParse(payload).success ? payload : null;
    case "shot_generate_complete":
    case "shot_generate_request":
      return outfitShotGeneratePayloadSchema.safeParse(payload).success ? payload : null;
    case "compose_complete":
      return outfitComposePayloadSchema.safeParse(payload).success ? payload : null;
    default:
      return null;
  }
}
