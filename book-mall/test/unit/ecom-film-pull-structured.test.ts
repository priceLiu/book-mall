import { describe, expect, it } from "vitest";

import {
  extractFilmPullAnalyzePatch,
  extractFilmPullRenderScriptPatch,
  resolveFilmPullParseError,
  validateFilmPullAnalyzeQuality,
} from "@/lib/ecom/ecom-film-pull-structured";

const sampleShot = {
  shotNo: 1,
  startTimeSec: 0,
  endTimeSec: 3,
  durationSec: 3,
  cutTransition: "硬切",
  cutDetail: "开场硬切",
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
  shootingPrep: {
    venue: "室内棚拍",
    costume: "日常装",
    props: "无",
    equipment: "三脚架",
  },
  narrativeLogic: "五段式：钩子→价值→CTA→教程→结果",
  beatPoints: "0s 硬切开场；3s BGM 起；6s 转场",
  replicableShootingScript: "机位固定三脚架；柔光主灯 45°；按镜序逐条拍摄",
  shots: [sampleShot],
};

describe("extractFilmPullAnalyzePatch", () => {
  it("parses ```film-pull fenced JSON", () => {
    const text = `分析完成\n\`\`\`film-pull\n${JSON.stringify(analyzeBody)}\n\`\`\``;
    const patch = extractFilmPullAnalyzePatch(text);
    expect(patch?.shots).toHaveLength(1);
    expect(patch?.meta.narrativeMainLine).toBe("测试叙事");
    expect(patch?.narrativeLogic).toContain("五段式");
  });

  it("returns null for invalid payload", () => {
    expect(extractFilmPullAnalyzePatch('{"schemaVersion":1}')).toBeNull();
  });

  it("coerces empty strings, numeric strings, and missing audioInfo", () => {
    const loose = {
      schemaVersion: "1",
      action: "analyze_complete",
      meta: {
        totalDurationSec: "68",
        narrativeMainLine: "",
        editRhythmCurve: "平稳",
        artStyle: "写实",
        audioDesignLogic: "",
        shotSequenceLogic: "",
        cameraLanguageSummary: "",
      },
      narrativeLogic: "",
      beatPoints: "0s 开场",
      replicableShootingScript: "",
      shots: [
        {
          shotNo: "1",
          startTimeSec: "0",
          endTimeSec: "3.5",
          durationSec: "3.5",
          cutTransition: "",
          shotScale: "中景",
          cameraAngle: "",
          cameraMovement: "",
          focalLengthPerspective: "",
          composition: "",
          subjectBlocking: "",
          sightDirection: "",
          sceneEnvironment: "室内",
          foreMidBackLayer: "",
          dynamicProps: "",
          lightingSetup: "",
          toneContrast: "",
          narrativeFunction: "",
          voiceover: "口播字幕",
          rhythmWeight: "",
          visualMetaphor: "",
          aiVisualPrompt: "A woman holding a product",
        },
      ],
    };
    const text = `\`\`\`film-pull\n${JSON.stringify(loose)}\n\`\`\``;
    const patch = extractFilmPullAnalyzePatch(text);
    expect(patch?.meta.totalDurationSec).toBe(68);
    expect(patch?.shots[0]?.audioInfo.scriptSubtitle).toBe("口播字幕");
    expect(patch?.shots[0]?.cameraAngle).toBe("平视");
  });

  it("repairs trailing commas in fenced JSON", () => {
    const text = `\`\`\`film-pull\n${JSON.stringify(analyzeBody).replace(
      '"cameraLanguageSummary": "固定为主"',
      '"cameraLanguageSummary": "固定为主",',
    )}\n\`\`\``;
    expect(extractFilmPullAnalyzePatch(text)?.shots).toHaveLength(1);
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

describe("validateFilmPullAnalyzeQuality", () => {
  it("passes a well-filled analyze patch", () => {
    const text = `\`\`\`film-pull\n${JSON.stringify(analyzeBody)}\n\`\`\``;
    const patch = extractFilmPullAnalyzePatch(text);
    expect(patch).not.toBeNull();
    expect(validateFilmPullAnalyzeQuality(patch!)).toBeNull();
  });

  it("rejects when venue is placeholder", () => {
    const text = `\`\`\`film-pull\n${JSON.stringify({
      ...analyzeBody,
      shootingPrep: { ...analyzeBody.shootingPrep, venue: "无" },
    })}\n\`\`\``;
    const patch = extractFilmPullAnalyzePatch(text);
    expect(validateFilmPullAnalyzeQuality(patch!)).toMatch(/venue/);
  });
});
