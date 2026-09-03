/**
 * Script Studio 工业化剧本批次 · JSON 契约（canvas-web 真源）
 * book-mall/lib/canvas/data/script-studio-batch-schema.ts 须保持同步
 */
import { z } from "zod";

export const SCRIPT_STUDIO_BATCH_FENCE_TAG = "script-studio-batch";
export const SCRIPT_STUDIO_BATCH_SCHEMA_VERSION = 1 as const;
export const SCRIPT_STUDIO_FORMAT_JSON_V1 = "json-v1" as const;

export const SCRIPT_STUDIO_BATCH_ACTIONS = [
  "batch_complete",
  "first_round_with_bibles",
] as const;
export type ScriptStudioBatchAction = (typeof SCRIPT_STUDIO_BATCH_ACTIONS)[number];

export const SCRIPT_STUDIO_SYSTEMS = ["original", "adaptation"] as const;
export type ScriptStudioBatchSystem = (typeof SCRIPT_STUDIO_SYSTEMS)[number];

const characterLockSchema = z.object({
  name: z.string().min(1),
  age: z.string().min(1),
  bodyType: z.string().min(1),
  faceShape: z.string().min(1),
  facialFeatures: z.string().min(1),
  temperament: z.string().min(1),
  skin: z.string().min(1),
  hair: z.string().min(1),
  outfit: z.string().min(1),
  accessories: z.string().min(1),
  episodeOutfit: z.string().min(1),
  emotion: z.string().min(1),
  behavior: z.string().min(1),
  speechStyle: z.string().min(1),
});

const sceneArchiveSchema = z.object({
  name: z.string().min(1),
  intExt: z.string().min(1),
  time: z.string().min(1),
  decor: z.string().min(1),
  lighting: z.string().min(1),
  mood: z.string().min(1),
  props: z.string().min(1),
  ambientSound: z.string().min(1),
});

const propItemSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  role: z.string().min(1),
  texture: z.string().min(1),
  placement: z.string().min(1),
  eraOk: z.string().min(1),
  closeUp: z.string().min(1),
});

const storyboardShotSchema = z.object({
  frameIndex: z.number().int().positive(),
  duration: z.string().min(1),
  shotSize: z.string().min(1),
  cameraMove: z.string().min(1),
  description: z.string().min(1),
  characterDetail: z.string().min(1),
  dialogue: z.string().min(1),
  emotion: z.string().min(1),
  bgm: z.string().min(1),
});

const imagePromptPairSchema = z.object({
  frameIndex: z.number().int().positive(),
  zh: z.string().min(1),
  en: z.string().min(1),
});

const module1BaseSchema = z.object({
  episodeNo: z.number().int().positive(),
  standardDuration: z.string().min(1),
  coreTheme: z.string().min(1),
  prevEpisodeHook: z.string().min(1),
  conflictClosure: z.string().min(1),
  cliffhanger: z.string().min(1),
});

const frozenBiblesSchema = z.object({
  worldview: z.string().min(1),
  characters: z.string().min(1),
  scenes: z.string().min(1),
  synopsis: z.string().min(1),
});

const batchRangeSchema = z.object({
  startEpisode: z.number().int().positive(),
  endEpisode: z.number().int().positive(),
  totalEpisodes: z.number().int().positive(),
});

export const scriptStudioEpisodeSchema = z.object({
  episodeNo: z.number().int().positive(),
  title: z.string().optional(),
  module1_base: module1BaseSchema,
  module2_characters: z.array(characterLockSchema).min(1),
  module3_scenes: z.array(sceneArchiveSchema).min(1),
  module4_props: z.array(propItemSchema),
  module5_outline: z.string().min(1),
  module6_script: z.string().min(1),
  module7_storyboard: z.array(storyboardShotSchema).min(1),
  module8_imagePrompts: z.array(imagePromptPairSchema).min(1),
  module9_videoParams: z.string().min(1),
  module10_editNotes: z.string().min(1),
});

export const scriptStudioBatchSchema = z.object({
  schemaVersion: z.literal(SCRIPT_STUDIO_BATCH_SCHEMA_VERSION),
  action: z.enum(SCRIPT_STUDIO_BATCH_ACTIONS),
  system: z.enum(SCRIPT_STUDIO_SYSTEMS),
  batch: batchRangeSchema,
  frozenBibles: frozenBiblesSchema.optional(),
  validationReport: z.string().optional(),
  episodes: z.array(scriptStudioEpisodeSchema).min(1),
});

export type ScriptStudioBatchJson = z.infer<typeof scriptStudioBatchSchema>;
export type ScriptStudioEpisodeJson = z.infer<typeof scriptStudioEpisodeSchema>;
export type ScriptStudioFrozenBiblesJson = z.infer<typeof frozenBiblesSchema>;

export function listScriptStudioBatchIssues(
  batch: ScriptStudioBatchJson,
): string[] {
  const issues: string[] = [];
  const { startEpisode, endEpisode } = batch.batch;
  if (startEpisode > endEpisode) {
    issues.push("batch.startEpisode 不能大于 endEpisode");
  }
  const expectedCount = endEpisode - startEpisode + 1;
  if (batch.episodes.length !== expectedCount) {
    issues.push(
      `episodes 数量须为 ${expectedCount}（第 ${startEpisode}-${endEpisode} 集），当前 ${batch.episodes.length}`,
    );
  }
  const episodeNos = batch.episodes.map((e) => e.episodeNo).sort((a, b) => a - b);
  for (let i = 0; i < expectedCount; i++) {
    const expectedNo = startEpisode + i;
    if (episodeNos[i] !== expectedNo) {
      issues.push(`缺少第 ${expectedNo} 集或集号顺序错误`);
      break;
    }
  }
  if (
    batch.action === "first_round_with_bibles" &&
    !batch.frozenBibles?.worldview?.trim()
  ) {
    issues.push("首轮 action=first_round_with_bibles 须含 frozenBibles");
  }
  for (const ep of batch.episodes) {
    const frameIndexes = new Set(ep.module7_storyboard.map((s) => s.frameIndex));
    for (const prompt of ep.module8_imagePrompts) {
      if (!frameIndexes.has(prompt.frameIndex)) {
        issues.push(
          `第 ${ep.episodeNo} 集 module8 镜 ${prompt.frameIndex} 在 module7 中不存在`,
        );
      }
    }
    for (const shot of ep.module7_storyboard) {
      const pair = ep.module8_imagePrompts.find(
        (p) => p.frameIndex === shot.frameIndex,
      );
      if (!pair) {
        issues.push(
          `第 ${ep.episodeNo} 集 module7 镜 ${shot.frameIndex} 缺少 module8 中英提示词对`,
        );
      }
    }
  }
  return issues;
}

export function parseScriptStudioBatchJson(
  parsed: unknown,
): { ok: true; batch: ScriptStudioBatchJson } | { ok: false; error: string } {
  const result = scriptStudioBatchSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .slice(0, 8)
      .map((i) => {
        const path = i.path.length ? i.path.join(".") : "root";
        return `${path}: ${i.message}`;
      })
      .join("；");
    return { ok: false, error: issues || "Zod 校验失败" };
  }
  const semantic = listScriptStudioBatchIssues(result.data);
  if (semantic.length) {
    return { ok: false, error: semantic.slice(0, 4).join("；") };
  }
  return { ok: true, batch: result.data };
}
