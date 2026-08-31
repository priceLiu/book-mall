export type FilmPullShot = {
  shotNo: number;
  startTimeSec: number;
  endTimeSec: number;
  durationSec: number;
  cutTransition: string;
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

export type FilmPullAnalyzePatch = {
  schemaVersion: 1;
  action: "analyze_complete";
  meta: {
    totalDurationSec: number;
    narrativeMainLine: string;
    editRhythmCurve: string;
    artStyle: string;
    audioDesignLogic: string;
    shotSequenceLogic: string;
    cameraLanguageSummary: string;
  };
  shots: FilmPullShot[];
};

export type FilmPullRenderScriptPatch = FilmPullAnalyzePatch & {
  action: "render_script_complete";
  renderGlobalConfig: {
    characterUnifiedStyle: string;
    globalLighting: string;
    resolution: string;
    fps: string;
    globalVisualTone: string;
  };
};

export type FilmPullMediaReference = {
  id: string;
  ossUrl: string;
  durationSec?: number;
  source: "upload" | "url" | "asset";
  label?: string;
};

export type FilmPullCharacterRef = {
  id: string;
  ossUrl: string;
  label?: string;
};

export type FilmPullRenderShot = {
  shotNo: number;
  videoPrompt: string;
  durationSec: number;
  videoUrl?: string;
  voiceover?: string;
};

export type FilmPullProject = {
  id: string;
  title: string | null;
  module: string;
  status: string;
  settings: {
    chatModelKey?: string;
    videoModelKey?: string;
    aspectRatio?: "16:9" | "9:16";
  };
  media: FilmPullMediaReference | null;
  analyzeResult: {
    structured?: FilmPullAnalyzePatch | null;
    parseError?: string | null;
  } | null;
  renderScript: {
    structured?: FilmPullRenderScriptPatch | null;
    parseError?: string | null;
  } | null;
  characterRefs: FilmPullCharacterRef[];
  renderPlan: {
    shots: FilmPullRenderShot[];
    render?: { jobId?: string; finalVideoUrl?: string };
  } | null;
  meta: {
    finalVideoUrl?: string;
  } | null;
  createdAt: string;
  updatedAt: string;
};

export type FilmPullPhase = "analyze" | "review" | "replace" | "output";

export function resolveFilmPullPhase(project: FilmPullProject | null): FilmPullPhase {
  if (!project?.analyzeResult?.structured) return "analyze";
  if (!project.renderScript?.structured) return "review";
  if (!project.renderPlan?.render?.finalVideoUrl) {
    return project.renderPlan?.shots.some((s) => s.videoUrl) ? "output" : "replace";
  }
  return "output";
}
