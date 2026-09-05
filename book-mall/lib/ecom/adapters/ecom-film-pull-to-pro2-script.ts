import type { FilmPullRenderScriptPatch } from "@/lib/ecom/ecom-film-pull-structured";
import type { Pro2ProductionScript } from "@/lib/canvas/data/pro2-production-script-schema";
import { PRO2_PRODUCTION_SCRIPT_SCHEMA_VERSION } from "@/lib/canvas/data/pro2-production-script-schema";

function isPlaceholder(value: string | undefined): boolean {
  const t = value?.trim() ?? "";
  return !t || t === "无" || t === "—" || t === "-";
}

function joinNonEmpty(parts: string[], sep = "，"): string {
  return parts.map((p) => p.trim()).filter((p) => p && !isPlaceholder(p)).join(sep);
}

function ensureCameraMove(raw: string): string {
  const t = raw.trim() || "固定机位";
  if (t.length >= 12) return t;
  return `固定机位，${t}，保持镜头稳定`;
}

function toSceneDescription(blocking: string, sight: string): string {
  const start = isPlaceholder(blocking) ? "保持画面主体" : blocking.trim();
  const eye = isPlaceholder(sight) ? "" : `，视线${sight.trim()}`;
  return `【起始】${start}${eye}。【结束】继承上一动作收束`;
}

function toLighting(env: string, setup: string, tone: string): string {
  return joinNonEmpty([env, setup, tone]) || "继承原片光影";
}

function toDialogue(subtitle: string): string {
  if (isPlaceholder(subtitle)) return "—";
  return subtitle.trim();
}

function padAudioNote(emotion: string, fx: string): string {
  const bits: string[] = [];
  if (!isPlaceholder(emotion)) bits.push(`情绪：${emotion.trim()}`);
  if (!isPlaceholder(fx)) bits.push(fx.trim());
  return bits.join("；") || "—";
}

export function filmPullRenderScriptToPro2ProductionScript(
  script: FilmPullRenderScriptPatch,
  opts?: { title?: string },
): Pro2ProductionScript {
  return {
    schemaVersion: PRO2_PRODUCTION_SCRIPT_SCHEMA_VERSION,
    meta: {
      title: opts?.title?.trim() || "视频拉片导入",
      synopsis: script.meta.narrativeMainLine,
      packProfile: "industrial",
      source: "film_pull",
      totalDurationSec: script.meta.totalDurationSec,
      editRhythmCurve: script.meta.editRhythmCurve,
      shotSequenceLogic: script.meta.shotSequenceLogic,
      cameraLanguageSummary: script.meta.cameraLanguageSummary,
      audioDesignLogic: script.meta.audioDesignLogic,
      narrativeLogic: script.narrativeLogic,
      beatPoints: script.beatPoints,
      replicableShootingScript: script.replicableShootingScript,
      shootingPrep: script.shootingPrep,
    },
    visualStyle: {
      pictureStyle: script.meta.artStyle,
      styleAnchor: script.meta.artStyle,
      globalColorTone: script.renderGlobalConfig.globalVisualTone,
      lighting: script.renderGlobalConfig.globalLighting,
      cinematography: script.meta.cameraLanguageSummary,
    },
    shots: script.shots.map((s) => ({
      index: s.shotNo,
      shotSize: s.shotScale,
      cameraMove: ensureCameraMove(s.cameraMovement),
      lighting: toLighting(s.sceneEnvironment, s.lightingSetup, s.toneContrast),
      sceneDescription: toSceneDescription(s.subjectBlocking, s.sightDirection),
      dialogue: toDialogue(s.audioInfo.scriptSubtitle),
      durationSec: s.durationSec,
      sfxNote: isPlaceholder(s.audioInfo.ambientSound)
        ? "—"
        : s.audioInfo.ambientSound,
      audioNote: padAudioNote(s.audioInfo.vocalEmotion, s.audioInfo.fxAndBgm),
      analysis: {
        timing: {
          startTimeSec: s.startTimeSec,
          endTimeSec: s.endTimeSec,
        },
        cut: {
          transition: s.cutTransition,
          detail: s.cutDetail,
        },
        cinematography: {
          cameraAngle: s.cameraAngle,
          focalLength: s.focalLengthPerspective,
          composition: s.composition,
        },
        blocking: {
          subjectBlocking: s.subjectBlocking,
          sightDirection: s.sightDirection,
          foreMidBackLayer: s.foreMidBackLayer,
          sceneEnvironment: s.sceneEnvironment,
          dynamicProps: s.dynamicProps,
        },
        look: {
          lightingSetup: s.lightingSetup,
          toneContrast: s.toneContrast,
        },
        narrative: {
          function: s.narrativeFunction,
          rhythmWeight: s.rhythmWeight,
          visualMetaphor: s.visualMetaphor,
        },
        audioInfo: { ...s.audioInfo },
        analysisDraftPrompt: s.aiVisualPrompt,
      },
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
