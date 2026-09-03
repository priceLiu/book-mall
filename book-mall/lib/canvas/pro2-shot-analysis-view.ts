/**
 * Pro2 shots[].analysis → 电商拉片 25 维展示 DTO（Hub 折叠面板与 ecom 表格共用语义）
 * canvas-web/lib/canvas/pro2-shot-analysis-view.ts 须保持同步
 */
import type { FilmPullAnalyzePatch, FilmPullShot } from "@/lib/ecom/ecom-film-pull-structured";
import type {
  Pro2ProductionScript,
  Pro2ProductionScriptShot,
} from "./data/pro2-production-script-schema";

const FALLBACK = "无";

function displayText(value: string | undefined | null, fallback = FALLBACK): string {
  const t = value?.trim();
  if (!t || t === "—" || t === "-") return fallback;
  return t;
}

function parseDialogueToSubtitle(dialogue: string | undefined): string {
  const d = dialogue?.trim() ?? "";
  if (!d || d === "—") return FALLBACK;
  const m = d.match(/[：:]\s*(.+)$/);
  return m?.[1]?.trim() || d;
}

function parseVocalEmotion(dialogue: string | undefined): string {
  const d = dialogue?.trim() ?? "";
  const m = d.match(/[（(]([^）)]+)[）)]/);
  return m?.[1]?.trim() || FALLBACK;
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
): FilmPullShot {
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
        audio?.scriptSubtitle ?? parseDialogueToSubtitle(shot.dialogue),
      ),
      vocalEmotion: displayText(
        audio?.vocalEmotion ?? parseVocalEmotion(shot.dialogue),
      ),
      ambientSound: displayText(audio?.ambientSound ?? shot.sfxNote),
      fxAndBgm: displayText(audio?.fxAndBgm ?? shot.audioNote),
    },
  };
}

/** v3 Pro2 真源 → 电商 UI 兼容 FilmPullAnalyzePatch（只读投影，不落库 v1） */
export function pro2ProductionScriptToFilmPullAnalyzePatch(
  script: Pro2ProductionScript,
): FilmPullAnalyzePatch {
  const prep = script.meta?.shootingPrep;
  const vs = script.visualStyle;
  return {
    schemaVersion: 1,
    action: "analyze_complete",
    meta: {
      totalDurationSec:
        script.meta?.totalDurationSec ??
        script.shots!.reduce((s, sh) => s + (sh.durationSec ?? 0), 0),
      narrativeMainLine: displayText(
        script.meta?.synopsis ?? script.meta?.narrativeLogic,
      ),
      editRhythmCurve: displayText(script.meta?.editRhythmCurve),
      artStyle: displayText(vs?.pictureStyle ?? vs?.styleAnchor),
      audioDesignLogic: displayText(script.meta?.audioDesignLogic),
      shotSequenceLogic: displayText(script.meta?.shotSequenceLogic),
      cameraLanguageSummary: displayText(
        script.meta?.cameraLanguageSummary ?? vs?.cinematography,
      ),
    },
    shootingPrep: {
      venue: displayText(prep?.venue),
      costume: displayText(prep?.costume),
      props: displayText(prep?.props),
      equipment: displayText(prep?.equipment),
    },
    narrativeLogic: displayText(script.meta?.narrativeLogic),
    beatPoints: displayText(script.meta?.beatPoints),
    replicableShootingScript: displayText(
      script.meta?.replicableShootingScript,
    ),
    shots: (script.shots ?? []).map(pro2ShotToFilmPullDisplayRow),
  };
}

/** 读库：v3 Pro2 或 legacy v1 film-pull → 统一展示 DTO */
export function resolveFilmPullAnalyzePatchForDisplay(
  stored: unknown,
): FilmPullAnalyzePatch | null {
  if (isPro2FilmPullProductionScript(stored)) {
    return pro2ProductionScriptToFilmPullAnalyzePatch(stored);
  }
  if (
    stored &&
    typeof stored === "object" &&
    (stored as FilmPullAnalyzePatch).schemaVersion === 1 &&
    Array.isArray((stored as FilmPullAnalyzePatch).shots)
  ) {
    return stored as FilmPullAnalyzePatch;
  }
  return null;
}
