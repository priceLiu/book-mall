import {
  filmPullAnalyzePatchSchema,
  filmPullRenderScriptPatchSchema,
  type FilmPullAnalyzePatch,
  type FilmPullRenderScriptPatch,
  type FilmPullShot,
} from "@/lib/ecom/ecom-film-pull-structured";

function mockShot(
  overrides: Pick<FilmPullShot, "shotNo" | "startTimeSec" | "endTimeSec" | "durationSec"> &
    Partial<FilmPullShot>,
): FilmPullShot {
  return {
    cutTransition: "硬切",
    shotScale: "中景",
    cameraAngle: "平视",
    cameraMovement: "固定机位",
    focalLengthPerspective: "标准 50mm",
    composition: "三分法",
    subjectBlocking: "主角居中面向镜头",
    sightDirection: "看镜头",
    sceneEnvironment: "简约室内，浅灰背景",
    foreMidBackLayer: "中景人物、背景虚化",
    dynamicProps: "手持产品",
    lightingSetup: "柔光主灯 45°",
    toneContrast: "低对比自然光",
    narrativeFunction: "建立",
    audioInfo: {
      scriptSubtitle: "夏季必备",
      vocalEmotion: "自然微笑",
      ambientSound: "环境音",
      fxAndBgm: "轻快 BGM",
    },
    rhythmWeight: "中",
    visualMetaphor: "无",
    aiVisualPrompt:
      "【Mock】Fashion e-commerce medium shot, young woman holding product, soft studio light, clean background",
    ...overrides,
  };
}

/** Dev mock · 专业拉片 analyze_complete（3 镜，12s） */
export const MOCK_FILM_PULL_ANALYZE_PATCH: FilmPullAnalyzePatch = {
  schemaVersion: 1,
  action: "analyze_complete",
  meta: {
    totalDurationSec: 12,
    narrativeMainLine: "【Mock】五段式带货短视频：钩子 → 卖点 → 演示 → 证明 → CTA",
    editRhythmCurve: "前快后稳，镜 1–2 快节奏，镜 3 收束",
    artStyle: "写实商业短片",
    audioDesignLogic: "环境音垫底 + 轻快 BGM + 口播为主",
    shotSequenceLogic: "建立 → 细节 → 效果展示",
    cameraLanguageSummary: "主机位固定 + 镜 2 慢推特写",
  },
  narrativeLogic:
    "【Mock】0–3s 钩子展示产品 → 3–8s 卖点讲解 → 8–12s 穿搭效果与 CTA。",
  beatPoints: "【Mock】0s 硬切开场；3s BGM 起；8s 转场至全身展示。",
  replicableShootingScript:
    "【Mock】机位：主机位三脚架 + 侧面 45° 辅机位；灯光：柔光主灯 + 轮廓光；按镜序逐条拍摄。",
  shots: [
    mockShot({
      shotNo: 1,
      startTimeSec: 0,
      endTimeSec: 3,
      durationSec: 3,
      shotScale: "中景",
      narrativeFunction: "钩子建立",
      aiVisualPrompt:
        "【Mock】Medium shot, woman smiling at camera holding product, e-commerce style",
    }),
    mockShot({
      shotNo: 2,
      startTimeSec: 3,
      endTimeSec: 8,
      durationSec: 5,
      shotScale: "特写",
      cameraMovement: "慢推",
      cameraAngle: "俯拍",
      narrativeFunction: "卖点细节",
      aiVisualPrompt:
        "【Mock】Close-up product fabric texture, fingers touching material, soft top light",
    }),
    mockShot({
      shotNo: 3,
      startTimeSec: 8,
      endTimeSec: 12,
      durationSec: 4,
      shotScale: "全景",
      cameraMovement: "跟拍",
      narrativeFunction: "效果收束",
      aiVisualPrompt:
        "【Mock】Full-body fashion shot, woman turning to show outfit, confident walk",
    }),
  ],
};

export function buildMockFilmPullRenderScript(
  analyze: FilmPullAnalyzePatch,
): FilmPullRenderScriptPatch {
  return {
    ...analyze,
    action: "render_script_complete",
    renderGlobalConfig: {
      characterUnifiedStyle: "【Mock】写实人像，新角色替换原片人物",
      globalLighting: "柔光主灯 + 环境补光，肤色自然",
      resolution: "1080p",
      fps: "24fps",
      globalVisualTone: "清新带货风，低饱和背景",
    },
    shots: analyze.shots.map((s) => ({
      ...s,
      aiVisualPrompt: `【Mock·换角】${s.aiVisualPrompt}`,
    })),
  };
}

export function assertMockFilmPullFixturesValid(): void {
  filmPullAnalyzePatchSchema.parse(MOCK_FILM_PULL_ANALYZE_PATCH);
  filmPullRenderScriptPatchSchema.parse(
    buildMockFilmPullRenderScript(MOCK_FILM_PULL_ANALYZE_PATCH),
  );
}

assertMockFilmPullFixturesValid();
