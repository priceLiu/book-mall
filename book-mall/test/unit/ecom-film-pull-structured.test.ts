import { describe, expect, it } from "vitest";

import {
  extractFilmPullAnalyzePatch,
  extractFilmPullRenderScriptPatch,
  resolveFilmPullParseError,
} from "@/lib/ecom/ecom-film-pull-structured";

const sampleShot = {
  shotNo: 1,
  startTimeSec: 0,
  endTimeSec: 3,
  durationSec: 3,
  cutTransition: "硬切",
  shotScale: "中景",
  cameraAngle: "平视",
  cameraMovement: "固定机位",
  focalLengthPerspective: "标准",
  composition: "三分法",
  subjectBlocking: "主角居中",
  sightDirection: "看镜头",
  sceneEnvironment: "室内",
  foreMidBackLayer: "前景虚化",
  dynamicProps: "无",
  lightingSetup: "柔光",
  toneContrast: "低对比",
  narrativeFunction: "建立",
  audioInfo: {
    scriptSubtitle: "无",
    vocalEmotion: "无",
    ambientSound: "无",
    fxAndBgm: "无",
  },
  rhythmWeight: "中",
  visualMetaphor: "无",
  aiVisualPrompt: "A person standing in a room",
};

const analyzeBody = {
  schemaVersion: 1,
  action: "analyze_complete",
  meta: {
    totalDurationSec: 3,
    narrativeMainLine: "测试叙事",
    editRhythmCurve: "平稳",
    artStyle: "写实",
    audioDesignLogic: "环境音",
    shotSequenceLogic: "递进",
    cameraLanguageSummary: "固定为主",
  },
  shots: [sampleShot],
};

describe("extractFilmPullAnalyzePatch", () => {
  it("parses ```film-pull fenced JSON", () => {
    const text = `分析完成\n\`\`\`film-pull\n${JSON.stringify(analyzeBody)}\n\`\`\``;
    const patch = extractFilmPullAnalyzePatch(text);
    expect(patch?.shots).toHaveLength(1);
    expect(patch?.meta.narrativeMainLine).toBe("测试叙事");
  });

  it("returns null for invalid payload", () => {
    expect(extractFilmPullAnalyzePatch('{"schemaVersion":1}')).toBeNull();
  });
});

describe("extractFilmPullRenderScriptPatch", () => {
  it("requires renderGlobalConfig", () => {
    const body = {
      ...analyzeBody,
      action: "render_script_complete",
      renderGlobalConfig: {
        characterUnifiedStyle: "写实",
        globalLighting: "柔光",
        resolution: "1080p",
        fps: "24fps",
        globalVisualTone: "冷调",
      },
    };
    const text = `\`\`\`film-pull\n${JSON.stringify(body)}\n\`\`\``;
    const patch = extractFilmPullRenderScriptPatch(text);
    expect(patch?.renderGlobalConfig.globalVisualTone).toBe("冷调");
  });
});

describe("resolveFilmPullParseError", () => {
  it("reports missing fence", () => {
    expect(resolveFilmPullParseError("plain text", "analyze")).toMatch(/缺少/);
  });

  it("returns null when parse succeeds", () => {
    const text = `\`\`\`film-pull\n${JSON.stringify(analyzeBody)}\n\`\`\``;
    expect(resolveFilmPullParseError(text, "analyze")).toBeNull();
  });
});
