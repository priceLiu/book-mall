import type { FilmPullRenderScriptPatch } from "@/lib/ecom/ecom-film-pull-structured";
import type { Pro2ProductionScript } from "@/lib/canvas/data/pro2-production-script-schema";
import { PRO2_PRODUCTION_SCRIPT_SCHEMA_VERSION } from "@/lib/canvas/data/pro2-production-script-schema";

export function filmPullRenderScriptToPro2ProductionScript(
  script: FilmPullRenderScriptPatch,
  opts?: { title?: string },
): Pro2ProductionScript {
  return {
    schemaVersion: PRO2_PRODUCTION_SCRIPT_SCHEMA_VERSION,
    step: "storyboard",
    tier: "pro",
    meta: {
      title: opts?.title?.trim() || "视频拉片导入",
      synopsis: script.meta.narrativeMainLine,
    },
    visualStyle: {
      pictureStyle: script.meta.artStyle,
      globalColorTone: script.renderGlobalConfig.globalVisualTone,
      lighting: script.renderGlobalConfig.globalLighting,
      cinematography: script.meta.cameraLanguageSummary,
    },
    shots: script.shots.map((s) => ({
      index: s.shotNo,
      shotSize: s.shotScale,
      cameraMove: s.cameraMovement,
      sceneDescription: [s.subjectBlocking, s.sceneEnvironment].filter(Boolean).join("，"),
      dialogue: s.audioInfo.scriptSubtitle !== "无" ? s.audioInfo.scriptSubtitle : "—",
      durationSec: s.durationSec,
      videoPrompt: s.aiVisualPrompt,
      frameImagePrompt: s.aiVisualPrompt,
      audioNote: s.audioInfo.fxAndBgm !== "无" ? s.audioInfo.fxAndBgm : "",
    })),
    characters: [],
    scenes: [],
    props: [],
    moods: [],
    audios: [],
    handoff: [],
  };
}

export function filmPullAnalyzeToPro2ProductionScript(
  analyze: import("@/lib/ecom/ecom-film-pull-structured").FilmPullAnalyzePatch,
  opts?: { title?: string },
): Pro2ProductionScript {
  const pseudo: FilmPullRenderScriptPatch = {
    ...analyze,
    action: "render_script_complete",
    renderGlobalConfig: {
      characterUnifiedStyle: analyze.meta.artStyle,
      globalLighting: "继承原片",
      resolution: "1080×1920",
      fps: "24fps",
      globalVisualTone: analyze.meta.artStyle,
    },
  };
  return filmPullRenderScriptToPro2ProductionScript(pseudo, opts);
}
