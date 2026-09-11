import { z } from "zod";

/** 逐镜场景融图（人物+场景 → Kling 参考图） */
export const outfitSceneFusionSchema = z.object({
  mode: z.enum(["follow_reference", "library", "upload_ref"]).optional(),
  libraryEntryId: z.string().optional(),
  libraryEntryName: z.string().optional(),
  sceneRefUrl: z.string().optional(),
  visualPromptFragment: z.string().optional(),
  fusedImageUrl: z.string().optional(),
  fusionModelKey: z.string().optional(),
  sharedFromShotIndex: z.number().int().positive().optional(),
  status: z.enum(["pending", "generating", "success", "failed"]).optional(),
  failReason: z.string().optional(),
});

export type OutfitSceneFusion = z.infer<typeof outfitSceneFusionSchema>;

/** 拉片后 · 单镜分镜适配（服装识别 + LLM 改写） */
export const outfitStoryboardAdaptSchema = z.object({
  status: z.enum(["pending", "generating", "success", "failed"]).optional(),
  failReason: z.string().optional(),
  originalStoryboard: z.string().optional(),
  clothAnalyse: z.string().optional(),
  userSellPoint: z.string().optional(),
  mode: z.string().optional(),
  adjustLogic: z.string().optional(),
  cameraMove: z.string().optional(),
  characterAction: z.string().optional(),
  lightingSetup: z.string().optional(),
  sceneBackground: z.string().optional(),
  finalStoryboard: z.string().optional(),
  positivePrompt: z.string().optional(),
  negativePrompt: z.string().optional(),
  adaptedAt: z.string().optional(),
  splitModelKey: z.string().optional(),
});

export type OutfitStoryboardAdapt = z.infer<typeof outfitStoryboardAdaptSchema>;

/** AI 生成后的分镜制作表（用户可编辑；与拆解分镜表字段分离） */
export const outfitProductionSchema = z.object({
  status: z.enum(["pending", "generating", "success", "failed"]).optional(),
  failReason: z.string().optional(),
  cameraMove: z.string().optional(),
  characterAction: z.string().optional(),
  lightingSetup: z.string().optional(),
  sceneBackground: z.string().optional(),
  finalStoryboard: z.string().optional(),
  positivePrompt: z.string().optional(),
  negativePrompt: z.string().optional(),
  adjustLogic: z.string().optional(),
  mode: z.string().optional(),
  generatedAt: z.string().optional(),
  splitModelKey: z.string().optional(),
});

export type OutfitProduction = z.infer<typeof outfitProductionSchema>;

export const sceneShotSchema = z.object({
  sceneId: z.string().min(1),
  index: z.number().int().positive(),
  startTimeSec: z.number().nonnegative(),
  endTimeSec: z.number().positive(),
  durationSec: z.number().positive(),
  cameraType: z.string().optional(),
  motionType: z.string().optional(),
  /** 逐镜 enrich · 可观测动作描述 */
  characterAction: z.string().optional(),
  /** 逐镜 enrich · 可执行运镜描述 */
  cameraMove: z.string().optional(),
  /** 逐镜 enrich · 布光 */
  lightingSetup: z.string().optional(),
  /** 逐镜 enrich · 场景/背景 */
  sceneBackground: z.string().optional(),
  /** 逐镜 enrich · 影调（可选） */
  toneContrast: z.string().optional(),
  /** §十 · 拆镜 enrich 光影/场景识别不足 */
  parseIncomplete: z.boolean().optional(),
  /** §十 · 用户编辑后的逐镜正向 Prompt（可空字符串 = 不传 Kling prompt） */
  userGeneratePrompt: z.string().optional(),
  previewImageUrl: z.string().optional(),
  keypointsUrl: z.string().optional(),
  referenceClipUrl: z.string().optional(),
  videoUrl: z.string().optional(),
  status: z.enum(["pending", "generating", "success", "failed"]).optional(),
  failReason: z.string().optional(),
  sceneFusion: outfitSceneFusionSchema.optional(),
  /** 服装适配后的单镜分镜（LLM 快照，批量生成时写入） */
  outfitStoryboardAdapt: outfitStoryboardAdaptSchema.optional(),
  /** 分镜制作表 · 用户可编辑的生产字段 */
  outfitProduction: outfitProductionSchema.optional(),
});

export type SceneShot = z.infer<typeof sceneShotSchema>;

const refImageSourceSchema = z.enum([
  "upload",
  "library",
  "asset",
  "wardrobe",
  "aitryon-plus",
  "ai-generate",
]);

export const workflowRefImageSchema = z.object({
  ossUrl: z.string().min(1),
  source: refImageSourceSchema.optional(),
  label: z.string().optional(),
});

export type WorkflowRefImage = z.infer<typeof workflowRefImageSchema>;

export const outfitModelGalleryItemSchema = workflowRefImageSchema.extend({
  id: z.string().min(1),
});

export type OutfitModelGalleryItem = z.infer<typeof outfitModelGalleryItemSchema>;

/** 穿搭参考 · 场景库预设（无参考图，仅 prompt 片段） */
export const outfitSceneLibraryPresetSchema = z.object({
  entryId: z.string().min(1),
  entryName: z.string().min(1),
  visualPromptFragment: z.string().min(1),
});

export type OutfitSceneLibraryPreset = z.infer<typeof outfitSceneLibraryPresetSchema>;

export const workflowRefsSchema = z.object({
  referenceVideo: z
    .object({
      ossUrl: z.string().min(1),
      label: z.string().optional(),
    })
    .optional(),
  model: workflowRefImageSchema.optional(),
  /** 穿搭视频 · 多张穿搭参考；首张同步为 model */
  modelGallery: z.array(outfitModelGalleryItemSchema).optional(),
  clothing: workflowRefImageSchema.optional(),
  /** 上下装 · 上装（需穿衣 two_piece） */
  topGarment: workflowRefImageSchema.optional(),
  /** 上下装 · 下装（需穿衣 two_piece） */
  bottomGarment: workflowRefImageSchema.optional(),
  /** 锁定后的穿搭成片 · 逐镜生成唯一人物参考 */
  dressedImage: workflowRefImageSchema.optional(),
  /** 全片默认场景参考图（融图 style_ref；逐镜可覆盖） */
  sceneRef: workflowRefImageSchema.optional(),
  /** 全片默认场景库预设（场景提示词；与 sceneRef 二选一） */
  sceneLibraryPreset: outfitSceneLibraryPresetSchema.optional(),
});

export type WorkflowRefs = z.infer<typeof workflowRefsSchema>;

export const workflowMediaInputSchema = z.object({
  referenceVideoUrl: z.string().min(1),
  aspectRatio: z.enum(["9:16", "16:9"]).optional(),
});

export type WorkflowMediaInput = z.infer<typeof workflowMediaInputSchema>;

export const workflowComposeResultSchema = z.object({
  videoUrl: z.string().min(1),
  coverUrl: z.string().optional(),
  videoInfo: z
    .object({
      durationSec: z.number().positive(),
      resolution: z.string(),
      fps: z.number().positive(),
      aspectRatio: z.string(),
    })
    .optional(),
  sceneResultList: z
    .array(
      z.object({
        sceneId: z.string().min(1),
        sceneVideoUrl: z.string().optional(),
        status: z.enum(["success", "failed"]),
      }),
    )
    .optional(),
  constraintResult: z.record(z.unknown()).optional(),
});

export type WorkflowComposeResult = z.infer<typeof workflowComposeResultSchema>;

export function normalizeSceneIndices(scenes: SceneShot[]): SceneShot[] {
  return scenes
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((scene, i) => ({
      ...scene,
      index: i + 1,
    }));
}

export function sanitizeSceneList(raw: unknown): SceneShot[] {
  if (!Array.isArray(raw)) return [];
  const out: SceneShot[] = [];
  for (const row of raw) {
    const parsed = sceneShotSchema.safeParse(row);
    if (parsed.success) out.push(parsed.data);
  }
  return normalizeSceneIndices(out);
}
