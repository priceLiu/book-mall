import { describe, expect, it } from "vitest";

import {
  pro2ProductionScriptToFilmPullAnalyzePatch,
  pro2ShotToFilmPullDisplayRow,
} from "@/lib/canvas/pro2-shot-analysis-view";
import type { Pro2ProductionScript } from "@/lib/canvas/data/pro2-production-script-schema";

describe("pro2-shot-analysis-view", () => {
  it("maps v3 film_pull shot analysis to 25-col display row", () => {
    const row = pro2ShotToFilmPullDisplayRow({
      index: 1,
      shotSize: "特写",
      cameraMove: "固定机位缓慢推近",
      lighting: "冷蓝",
      sceneDescription: "【起始】加班【结束】定格",
      dialogue: "—",
      durationSec: 5,
      sfxNote: "键盘声",
      audioNote: "—",
      analysis: {
        timing: { startTimeSec: 0, endTimeSec: 5 },
        cut: { transition: "硬切", detail: "动作切点" },
        cinematography: {
          cameraAngle: "平视",
          focalLength: "35mm",
          composition: "居中",
        },
        blocking: {
          subjectBlocking: "伏案",
          sightDirection: "看屏幕",
          sceneEnvironment: "办公室",
          foreMidBackLayer: "前景显示器",
          dynamicProps: "电脑",
        },
        look: { lightingSetup: "屏幕冷光", toneContrast: "高对比" },
        narrative: {
          function: "建立",
          rhythmWeight: "轻",
          visualMetaphor: "—",
        },
        audioInfo: {
          scriptSubtitle: "无",
          vocalEmotion: "无",
          ambientSound: "键盘",
          fxAndBgm: "—",
        },
        analysisDraftPrompt: "draft prompt",
      },
    });
    expect(row.shotNo).toBe(1);
    expect(row.sceneEnvironment).toBe("办公室");
    expect(row.cutDetail).toBe("动作切点");
    expect(row.aiVisualPrompt).toBe("draft prompt");
  });

  it("projects full script to FilmPullAnalyzePatch for ecom UI", () => {
    const script: Pro2ProductionScript = {
      schemaVersion: 3,
      meta: {
        title: "测试",
        synopsis: "主线",
        packProfile: "industrial",
        source: "film_pull",
        totalDurationSec: 5,
        shootingPrep: {
          venue: "棚",
          costume: "现代",
          props: "电脑",
          equipment: "稳定器",
        },
      },
      shots: [
        {
          index: 1,
          shotSize: "特写",
          cameraMove: "固定机位缓慢推近",
          lighting: "冷蓝",
          sceneDescription: "加班",
          dialogue: "—",
          durationSec: 5,
          sfxNote: "键盘",
          audioNote: "—",
          analysis: {
            cut: { transition: "硬切", detail: "切" },
            blocking: { sceneEnvironment: "办公室", subjectBlocking: "伏案" },
          },
        },
      ],
    };
    const patch = pro2ProductionScriptToFilmPullAnalyzePatch(script);
    expect(patch.shots).toHaveLength(1);
    expect(patch.meta.narrativeMainLine).toBe("主线");
    expect(patch.shootingPrep.venue).toBe("棚");
  });
});
