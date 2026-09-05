/**
 * Pro2 shots[].analysis → 电商拉片 25 维展示 DTO（Hub 折叠面板与 ecom 表格共用语义）
 * book-mall/lib/canvas/pro2-shot-analysis-view.ts 须保持同步
 */
import type {
  Pro2ProductionScript,
  Pro2ProductionScriptShot,
} from "./data/pro2-production-script-schema";

const FALLBACK = "无";

export type Pro2FilmPullDisplayShot = {
  shotNo: number;
  startTimeSec: number;
  endTimeSec: number;
  durationSec: number;
  cutTransition: string;
  cutDetail: string;
  shotScale: string;
  cameraAngle: string;
  cameraMovement: string;
  focalLengthPerspective: string;
  composition: string;
  subjectBlocking: string;
  sightDirection: string;
  sceneEnvironment: string;
  foreMidBackLayer: string;
  dynamicProps: string;
  lightingSetup: string;
  toneContrast: string;
  narrativeFunction: string;
  audioInfo: {
    scriptSubtitle: string;
    vocalEmotion: string;
    ambientSound: string;
    fxAndBgm: string;
  };
  rhythmWeight: string;
  visualMetaphor: string;
  aiVisualPrompt: string;
};

function displayText(value: string | undefined | null, fallback = FALLBACK): string {
  const t = value?.trim();
  if (!t || t === "—" || t === "-") return fallback;
  return t;
}

export function isPro2FilmPullProductionScript(
  raw: unknown,
): raw is Pro2ProductionScript {
  if (!raw || typeof raw !== "object") return false;
  const o = raw as Pro2ProductionScript;
  return (
    o.schemaVersion === 3 &&
    o.meta?.source === "film_pull" &&
    Array.isArray(o.shots) &&
    o.shots.length > 0
  );
}

export function pro2ShotToFilmPullDisplayRow(
  shot: Pro2ProductionScriptShot,
): Pro2FilmPullDisplayShot {
  const a = shot.analysis;
  const timing = a?.timing;
  const audio = a?.audioInfo;
  const durationSec =
    typeof shot.durationSec === "number" && shot.durationSec > 0
      ? shot.durationSec
      : timing
        ? Math.max(0, timing.endTimeSec - timing.startTimeSec)
        : 0;
  const startTimeSec = timing?.startTimeSec ?? 0;
  const endTimeSec =
    timing?.endTimeSec ?? (startTimeSec + durationSec);

  return {
    shotNo: shot.index,
    startTimeSec,
    endTimeSec,
    durationSec: durationSec || endTimeSec - startTimeSec,
    cutTransition: displayText(a?.cut?.transition),
    cutDetail: displayText(a?.cut?.detail),
    shotScale: displayText(shot.shotSize),
    cameraAngle: displayText(a?.cinematography?.cameraAngle),
    cameraMovement: displayText(shot.cameraMove ?? a?.cinematography?.composition),
    focalLengthPerspective: displayText(a?.cinematography?.focalLength),
    composition: displayText(a?.cinematography?.composition),
    subjectBlocking: displayText(a?.blocking?.subjectBlocking),
    sightDirection: displayText(a?.blocking?.sightDirection),
    sceneEnvironment: displayText(a?.blocking?.sceneEnvironment),
    foreMidBackLayer: displayText(a?.blocking?.foreMidBackLayer),
    dynamicProps: displayText(a?.blocking?.dynamicProps),
    lightingSetup: displayText(a?.look?.lightingSetup),
    toneContrast: displayText(a?.look?.toneContrast),
    narrativeFunction: displayText(a?.narrative?.function),
    rhythmWeight: displayText(a?.narrative?.rhythmWeight),
    visualMetaphor: displayText(a?.narrative?.visualMetaphor),
    aiVisualPrompt: displayText(
      a?.analysisDraftPrompt ?? shot.sceneDescription,
    ),
    audioInfo: {
      scriptSubtitle: displayText(
        audio?.scriptSubtitle ?? shot.dialogue,
      ),
      vocalEmotion: displayText(audio?.vocalEmotion),
      ambientSound: displayText(audio?.ambientSound ?? shot.sfxNote),
      fxAndBgm: displayText(audio?.fxAndBgm ?? shot.audioNote),
    },
  };
}
