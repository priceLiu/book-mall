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
  narrativeLogic: string;
  beatPoints: string;
  replicableShootingScript: string;
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
    lastAnalyzePrompt?: string;
    aspectRatio?: "16:9" | "9:16";
  };
  media: FilmPullMediaReference | null;
  analyzeResult: {
    rawText?: string;
    structured?: FilmPullAnalyzePatch | null;
    parseError?: string | null;
    completedAt?: string | null;
  } | null;
  renderScript: {
    structured?: FilmPullRenderScriptPatch | null;
    parseError?: string | null;
    completedAt?: string | null;
  } | null;
  characterRefs: FilmPullCharacterRef[];
  renderPlan: {
    shots: FilmPullRenderShot[];
    render?: { jobId?: string; finalVideoUrl?: string };
  } | null;
  meta: {
    finalVideoUrl?: string;
    analyzeStartedAt?: string;
    analyzeRunId?: string;
    analyzeCancelRunId?: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
};

export type FilmPullPhase = "analyze" | "review" | "replace" | "output";

/** 与 book-mall EcomFilmPullProject.status 对齐 */
export const FILM_PULL_PROJECT_STATUS = {
  DRAFT: "draft",
  ANALYZING: "analyzing",
  ANALYZED: "analyzed",
  RENDER_SCRIPTING: "render_scripting",
  RENDER_READY: "render_ready",
  FAILED: "failed",
} as const;

export type FilmPullProjectStatus =
  (typeof FILM_PULL_PROJECT_STATUS)[keyof typeof FILM_PULL_PROJECT_STATUS];

export function isFilmPullAnalyzeRunning(project: FilmPullProject | null): boolean {
  return isFilmPullAnalyzeActive(project);
}

/** 服务端 analyzing 且尚无终态结果 → 真正进行中 */
export function isFilmPullAnalyzeActive(project: FilmPullProject | null): boolean {
  if (!project) return false;
  if (project.status === FILM_PULL_PROJECT_STATUS.FAILED) return false;
  if (project.status !== FILM_PULL_PROJECT_STATUS.ANALYZING) return false;
  if (project.analyzeResult?.completedAt) return false;
  const meta = project.meta;
  if (
    meta?.analyzeCancelRunId &&
    meta.analyzeRunId &&
    meta.analyzeCancelRunId === meta.analyzeRunId
  ) {
    return false;
  }
  return true;
}

export function isFilmPullRenderScriptRunning(project: FilmPullProject | null): boolean {
  return isFilmPullRenderScriptActive(project);
}

export function isFilmPullRenderScriptActive(project: FilmPullProject | null): boolean {
  if (!project) return false;
  if (project.status === FILM_PULL_PROJECT_STATUS.FAILED) return false;
  if (project.status !== FILM_PULL_PROJECT_STATUS.RENDER_SCRIPTING) return false;
  if (project.renderScript?.completedAt) return false;
  return true;
}

export function isFilmPullAnalyzeFailed(project: FilmPullProject | null): boolean {
  if (!project) return false;
  if (project.status === FILM_PULL_PROJECT_STATUS.FAILED) return true;
  return Boolean(
    project.analyzeResult?.completedAt &&
      !project.analyzeResult.structured &&
      project.analyzeResult.parseError,
  );
}

export function resolveFilmPullPhase(project: FilmPullProject | null): FilmPullPhase {
  if (!project?.analyzeResult?.structured) return "analyze";
  if (!project.renderScript?.structured) return "review";
  if (!project.renderPlan?.render?.finalVideoUrl) {
    return project.renderPlan?.shots.some((s) => s.videoUrl) ? "output" : "replace";
  }
  return "output";
}
