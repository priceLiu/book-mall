import { describe, expect, it } from "vitest";

import {
  filmPullAnalyzeToPro2ProductionScript,
  filmPullRenderScriptToPro2ProductionScript,
} from "@/lib/ecom/adapters/ecom-film-pull-to-pro2-script";
import type { FilmPullRenderScriptPatch } from "@/lib/ecom/ecom-film-pull-structured";

const renderScript: FilmPullRenderScriptPatch = {
  schemaVersion: 1,
  action: "render_script_complete",
  meta: {
    totalDurationSec: 6,
    narrativeMainLine: "主线",
    editRhythmCurve: "快",
    artStyle: "赛博",
    audioDesignLogic: "电子",
    shotSequenceLogic: "对比",
    cameraLanguageSummary: "手持",
  },
  renderGlobalConfig: {
    characterUnifiedStyle: "新角色",
    globalLighting: "霓虹",
    resolution: "1080x1920",
    fps: "24fps",
    globalVisualTone: "高饱和",
  },
  narrativeLogic: "主线递进",
  beatPoints: "3s 切点",
  replicableShootingScript: "手持跟拍",
  shots: [
    {
      shotNo: 1,
      startTimeSec: 0,
      endTimeSec: 3,
      durationSec: 3,
      cutTransition: "硬切",
      shotScale: "特写",
      cameraAngle: "仰拍",
      cameraMovement: "推镜",
      focalLengthPerspective: "广角",
      composition: "居中",
      subjectBlocking: "角色 A",
      sightDirection: "看画外",
      sceneEnvironment: "街道",
      foreMidBackLayer: "雨景",
      dynamicProps: "伞",
      lightingSetup: "霓虹反射",
      toneContrast: "高",
      narrativeFunction: "钩子",
      audioInfo: {
        scriptSubtitle: "台词一",
        vocalEmotion: "紧张",
        ambientSound: "雨",
        fxAndBgm: "低频",
      },
      rhythmWeight: "高",
      visualMetaphor: "孤独",
      aiVisualPrompt: "cyberpunk street close-up",
    },
  ],
};

describe("ecom-film-pull-to-pro2-script", () => {
  it("maps render script to Pro2 storyboard step", () => {
    const script = filmPullRenderScriptToPro2ProductionScript(renderScript, {
      title: "拉片测试",
    });
    expect(script.step).toBe("storyboard");
    expect(script.meta.title).toBe("拉片测试");
    expect(script.meta.synopsis).toBe("主线");
    expect(script.shots[0]?.index).toBe(1);
    expect(script.shots[0]?.videoPrompt).toContain("cyberpunk");
    expect(script.shots[0]?.dialogue).toBe("台词一");
  });

  it("falls back analyze to pseudo render script", () => {
    const analyze = {
      ...renderScript,
      action: "analyze_complete" as const,
    };
    delete (analyze as { renderGlobalConfig?: unknown }).renderGlobalConfig;
    const script = filmPullAnalyzeToPro2ProductionScript(analyze, { title: "仅拉片" });
    expect(script.shots).toHaveLength(1);
    expect(script.visualStyle?.pictureStyle).toBe("赛博");
  });
});
