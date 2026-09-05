import type { FilmPullAnalyzePatch } from "@/lib/ecom/ecom-film-pull-structured";
import type { SeedVideoShot } from "@/lib/ecom/ecom-seed-video-types";

const SHOT_DURATION_MIN = 3;
const SHOT_DURATION_MAX = 15;

function clampDuration(n: number, fallback = 5): number {
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.max(SHOT_DURATION_MIN, Math.min(SHOT_DURATION_MAX, Math.round(n)));
}

function joinPromptParts(parts: string[]): string {
  return parts
    .map((p) => p.trim())
    .filter(Boolean)
    .join("，");
}

export function buildDraftShotsFromFilmPull(structured: FilmPullAnalyzePatch): SeedVideoShot[] {
  const placeholder = {
    id: "ref-replica-model-draft",
    label: "@图片1",
    role: "seed-material" as const,
    ossUrl: "",
  };

  return structured.shots.map((shot, i) => {
    const index = Number.isFinite(shot.shotNo) && shot.shotNo > 0 ? shot.shotNo : i + 1;
    const spanSec =
      Number.isFinite(shot.endTimeSec) && Number.isFinite(shot.startTimeSec)
        ? shot.endTimeSec - shot.startTimeSec
        : 0;
    const durationSec = clampDuration(
      shot.durationSec > 0 ? shot.durationSec : spanSec > 0 ? spanSec : 5,
    );
    const videoPrompt =
      shot.aiVisualPrompt.trim() ||
      joinPromptParts([
        shot.shotScale,
        shot.cameraAngle,
        shot.cameraMovement,
        shot.composition,
        shot.subjectBlocking,
        shot.sceneEnvironment,
        shot.lightingSetup,
      ]);
    return {
      index,
      timeSlice: `${shot.startTimeSec}-${shot.endTimeSec}s`,
      refImageId: placeholder.id,
      refImageLabel: placeholder.label,
      sceneDescription:
        joinPromptParts([
          shot.subjectBlocking,
          shot.sceneEnvironment,
          shot.narrativeFunction,
        ]) || `镜头 ${index}`,
      videoPrompt: videoPrompt || `镜头 ${index}`,
      voiceover: shot.audioInfo?.scriptSubtitle?.trim() ?? "",
      durationSec,
    };
  });
}

export function buildFilmPullReplicaScriptUserPrompt(opts: {
  structured: FilmPullAnalyzePatch;
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
    "## 拉片结果（原片）",
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

export function buildFilmPullReplicaModelImagePromptUserMessage(
  structured: FilmPullAnalyzePatch,
): string {
  const tableJson = JSON.stringify(structured, null, 2);
  return [
    "原片拉片结果如下。请推断原片模特类型（性别、年龄感、风格），并写一条**不同面孔**的新模特文生图 Prompt，用于替换原模特：",
    "",
    tableJson,
  ].join("\n");
}
