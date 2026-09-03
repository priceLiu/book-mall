/** 客户端 · v3 Pro2 拉片 → FilmPullAnalyzePatch 展示投影（与 book-mall pro2-shot-analysis-view 同步） */

import type { FilmPullAnalyzePatch, FilmPullShot } from "@/lib/film-pull-types";

const FALLBACK = "无";

type Pro2FilmPullScript = {
  schemaVersion: 3;
  meta?: {
    source?: string;
    synopsis?: string;
    totalDurationSec?: number;
    editRhythmCurve?: string;
    audioDesignLogic?: string;
    shotSequenceLogic?: string;
    cameraLanguageSummary?: string;
    narrativeLogic?: string;
    beatPoints?: string;
    replicableShootingScript?: string;
    shootingPrep?: {
      venue?: string;
      costume?: string;
      props?: string;
      equipment?: string;
    };
  };
  visualStyle?: {
    pictureStyle?: string;
    styleAnchor?: string;
    cinematography?: string;
  };
  shots?: Pro2FilmPullShot[];
};

type Pro2FilmPullShot = {
  index: number;
  shotSize?: string;
  cameraMove?: string;
  lighting?: string;
  sceneDescription?: string;
  dialogue?: string;
  durationSec?: number;
  sfxNote?: string;
  audioNote?: string;
  analysis?: {
    timing?: { startTimeSec?: number; endTimeSec?: number };
    cut?: { transition?: string; detail?: string };
    cinematography?: {
      cameraAngle?: string;
      focalLength?: string;
      composition?: string;
    };
    blocking?: {
      subjectBlocking?: string;
      sightDirection?: string;
      sceneEnvironment?: string;
      foreMidBackLayer?: string;
      dynamicProps?: string;
    };
    look?: { lightingSetup?: string; toneContrast?: string };
    narrative?: {
      function?: string;
      rhythmWeight?: string;
      visualMetaphor?: string;
    };
    audioInfo?: {
      scriptSubtitle?: string;
      vocalEmotion?: string;
      ambientSound?: string;
      fxAndBgm?: string;
    };
    analysisDraftPrompt?: string;
  };
};

function displayText(value: string | undefined | null, fallback = FALLBACK): string {
  const t = value?.trim();
  if (!t || t === "—" || t === "-") return fallback;
  return t;
}

export function isPro2FilmPullProductionScript(
  raw: unknown,
): raw is Pro2FilmPullScript {
  if (!raw || typeof raw !== "object") return false;
  const o = raw as Pro2FilmPullScript;
  return (
    o.schemaVersion === 3 &&
    o.meta?.source === "film_pull" &&
    Array.isArray(o.shots) &&
    o.shots.length > 0
  );
}

function pro2ShotToFilmPullDisplayRow(shot: Pro2FilmPullShot): FilmPullShot {
  const a = shot.analysis;
  const timing = a?.timing;
  const audio = a?.audioInfo;
  const durationSec =
    typeof shot.durationSec === "number" && shot.durationSec > 0
      ? shot.durationSec
      : timing
        ? Math.max(0, (timing.endTimeSec ?? 0) - (timing.startTimeSec ?? 0))
        : 0;
  const startTimeSec = timing?.startTimeSec ?? 0;
  const endTimeSec = timing?.endTimeSec ?? startTimeSec + durationSec;

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
      scriptSubtitle: displayText(audio?.scriptSubtitle ?? shot.dialogue),
      vocalEmotion: displayText(audio?.vocalEmotion),
      ambientSound: displayText(audio?.ambientSound ?? shot.sfxNote),
      fxAndBgm: displayText(audio?.fxAndBgm ?? shot.audioNote),
    },
  };
}

export function pro2ProductionScriptToFilmPullAnalyzePatch(
  script: Pro2FilmPullScript,
): FilmPullAnalyzePatch {
  const prep = script.meta?.shootingPrep;
  const vs = script.visualStyle;
  return {
    schemaVersion: 1,
    action: "analyze_complete",
    meta: {
      totalDurationSec:
        script.meta?.totalDurationSec ??
        (script.shots ?? []).reduce((s, sh) => s + (sh.durationSec ?? 0), 0),
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
