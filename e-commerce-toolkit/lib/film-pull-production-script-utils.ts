import type {
  FilmPullProductionPlan,
  FilmPullProductionShot,
  FilmPullRefMatch,
} from "@/lib/film-pull-types";

const EMPTY_AUDIO = {
  scriptSubtitle: "无",
  vocalEmotion: "无",
  ambientSound: "无",
  fxAndBgm: "无",
} as const;

/** 深拷贝制作脚本镜头列表（弹层 draft 用） */
export function cloneProductionShots(shots: FilmPullProductionShot[]): FilmPullProductionShot[] {
  return shots.map((s) => ({
    ...s,
    audioInfo: { ...s.audioInfo },
    modelRefIds: [...s.modelRefIds],
    productRefIds: [...s.productRefIds],
  }));
}

/** 重排镜号为 1…N */
export function renumberProductionShots(shots: FilmPullProductionShot[]): FilmPullProductionShot[] {
  return shots.map((shot, index) => ({ ...shot, shotNo: index + 1 }));
}

/** 新增镜默认行：继承上一镜 ref / 景别，时间接在上一镜之后 */
export function createProductionShotRow(
  shotNo: number,
  previous?: FilmPullProductionShot,
): FilmPullProductionShot {
  const startTimeSec = previous?.endTimeSec ?? 0;
  const durationSec = previous?.durationSec ?? 5;
  return {
    shotNo,
    startTimeSec,
    endTimeSec: startTimeSec + durationSec,
    durationSec,
    cutTransition: previous?.cutTransition ?? "硬切",
    shotScale: previous?.shotScale ?? "中景",
    cameraAngle: previous?.cameraAngle ?? "无",
    cameraMovement: previous?.cameraMovement ?? "固定机位",
    focalLengthPerspective: previous?.focalLengthPerspective ?? "无",
    composition: previous?.composition ?? "无",
    subjectBlocking: previous?.subjectBlocking ?? "无",
    sightDirection: previous?.sightDirection ?? "无",
    sceneEnvironment: previous?.sceneEnvironment ?? "无",
    foreMidBackLayer: previous?.foreMidBackLayer ?? "无",
    dynamicProps: previous?.dynamicProps ?? "无",
    lightingSetup: previous?.lightingSetup ?? "无",
    toneContrast: previous?.toneContrast ?? "无",
    narrativeFunction: previous?.narrativeFunction ?? "无",
    audioInfo: { ...EMPTY_AUDIO },
    rhythmWeight: previous?.rhythmWeight ?? "无",
    visualMetaphor: previous?.visualMetaphor ?? "无",
    aiVisualPrompt: previous?.aiVisualPrompt ?? "无",
    productInteraction: previous?.productInteraction ?? "none",
    sellpointNote: previous?.sellpointNote ?? "",
    modelRefIds: [...(previous?.modelRefIds ?? [])],
    productRefIds: [...(previous?.productRefIds ?? [])],
    imagePrompt: "",
    videoPrompt: "",
    imageUrl: null,
    videoUrl: null,
    ttsUrl: null,
    status: "pending_script",
  };
}

export function addProductionShotRow(shots: FilmPullProductionShot[]): FilmPullProductionShot[] {
  const prev = shots[shots.length - 1];
  return renumberProductionShots([...shots, createProductionShotRow(shots.length + 1, prev)]);
}

export function deleteProductionShotRow(
  shots: FilmPullProductionShot[],
  shotNo: number,
): FilmPullProductionShot[] {
  if (shots.length <= 1) return shots;
  return renumberProductionShots(shots.filter((s) => s.shotNo !== shotNo));
}

/** 保存前同步 refMatch 镜序与 productionPlan 一致 */
export function syncRefMatchWithProductionShots(
  refMatch: FilmPullRefMatch | null | undefined,
  shots: FilmPullProductionShot[],
): FilmPullRefMatch {
  const oldByShotNo = new Map((refMatch?.shots ?? []).map((s) => [s.shotNo, s]));
  return {
    shots: shots.map((shot, index) => {
      const fromPlan = {
        shotNo: shot.shotNo,
        modelRefIds: [...shot.modelRefIds],
        productRefIds: [...shot.productRefIds],
      };
      const legacy = oldByShotNo.get(shot.shotNo) ?? refMatch?.shots[index];
      if (
        fromPlan.modelRefIds.length === 0 &&
        fromPlan.productRefIds.length === 0 &&
        legacy
      ) {
        return {
          shotNo: shot.shotNo,
          modelRefIds: [...legacy.modelRefIds],
          productRefIds: [...legacy.productRefIds],
        };
      }
      return fromPlan;
    }),
  };
}

export function productionShotsSnapshotEqual(
  a: FilmPullProductionShot[],
  b: FilmPullProductionShot[],
): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function buildProductionPlanPatch(
  plan: FilmPullProductionPlan,
  shots: FilmPullProductionShot[],
): FilmPullProductionPlan {
  return { ...plan, shots: renumberProductionShots(shots) };
}
