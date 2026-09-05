import { describe, expect, it } from "vitest";

import {
  MEDIA_DECOMPOSE_NO_SPEECH,
  applyMediaDecomposeAsrOverlay,
  assignAsrVoiceoverToShots,
  buildMediaDecomposeAsrBundle,
  collectAsrTextInWindow,
  parseShotTimeWindowMs,
  resolveStoryboardTimeWindows,
} from "@/lib/ecom/ecom-media-decompose-asr";
import { extractMediaDecomposePatch } from "@/lib/ecom/ecom-media-decompose-structured";
import type { MediaDecomposePatch } from "@/lib/ecom/ecom-media-decompose-structured";

const segments = [
  { startMs: 0, endMs: 2500, text: "这件真的太好穿了" },
  { startMs: 3200, endMs: 7000, text: "面料轻薄透气，上身无负担" },
  { startMs: 8500, endMs: 11000, text: "通勤出游都能搭" },
];

describe("media-decompose ASR overlay", () => {
  it("parses range and sequential durations", () => {
    expect(parseShotTimeWindowMs("0-3s", 0)).toEqual({ startMs: 0, endMs: 3000 });
    expect(parseShotTimeWindowMs("3s", 0)).toEqual({ startMs: 0, endMs: 3000 });
    expect(parseShotTimeWindowMs("4s", 3000)).toEqual({ startMs: 3000, endMs: 7000 });
    expect(resolveStoryboardTimeWindows([{ duration: "0-3s" }, { duration: "3-8s" }])).toEqual([
      { startMs: 0, endMs: 3000 },
      { startMs: 3000, endMs: 8000 },
    ]);
  });

  it("joins first 3s and full transcript", () => {
    const bundle = buildMediaDecomposeAsrBundle(segments);
    expect(bundle.first3sLines).toBe("这件真的太好穿了");
    expect(bundle.fullTranscript).toBe(
      "这件真的太好穿了面料轻薄透气，上身无负担通勤出游都能搭",
    );
    expect(collectAsrTextInWindow(segments, 3000, 8000)).toBe("面料轻薄透气，上身无负担");
  });

  it("assigns each ASR segment to one shot only (no cross-shot duplication)", () => {
    const longSpan = [
      { startMs: 2000, endMs: 9000, text: "这车颜值真高，性能不错" },
      { startMs: 10000, endMs: 14000, text: "内饰也很精致" },
    ];
    const windows = [
      { startMs: 0, endMs: 3000 },
      { startMs: 3000, endMs: 6000 },
      { startMs: 6000, endMs: 9000 },
      { startMs: 9000, endMs: 12000 },
      { startMs: 12000, endMs: 15000 },
    ];
    const voiceovers = assignAsrVoiceoverToShots(longSpan, windows);
    expect(voiceovers.filter((v) => v === "这车颜值真高，性能不错")).toHaveLength(1);
    expect(voiceovers.filter((v) => v === "内饰也很精致")).toHaveLength(1);
    expect(voiceovers[1]).toBe("这车颜值真高，性能不错");
    expect(voiceovers[4]).toBe("内饰也很精致");
    expect(voiceovers[0]).toBe("");
    expect(voiceovers[2]).toBe("");
    expect(voiceovers[3]).toBe("");
  });

  it("uses placeholder when no speech", () => {
    const bundle = buildMediaDecomposeAsrBundle([]);
    expect(bundle.first3sLines).toBe(MEDIA_DECOMPOSE_NO_SPEECH);
    expect(bundle.fullTranscript).toBe(MEDIA_DECOMPOSE_NO_SPEECH);
  });

  it("overlays transcript and per-shot voiceover onto a video patch", () => {
    const raw = {
      mediaType: "video",
      action: "decompose_complete",
      visualStyle: "lookbook",
      globalColorTone: "暖调",
      cameraLanguageSummary: "固定",
      scenePrep: { venue: "棚", fixedProps: "" },
      openingHook: { firstFrame: "首帧模特举产品", first3sLines: "" },
      fullTranscript: "",
      talentAnalysis: {
        count: "1 人",
        appearance: "长发",
        expressionStyle: "对镜笑",
        blocking: "站姿",
      },
      wardrobeAnalysis: {
        garments: "针织开衫",
        changes: "全片同一套",
        stylingNotes: "垂感",
      },
      storyboardTable: [
        {
          shotNo: 1,
          duration: "0-3s",
          shotSize: "中景",
          cameraMove: "固定",
          cameraAngle: "平视",
          composition: "三分法",
          lightingSetup: "侧顺光",
          toneContrast: "低对比",
          visualContent: "开场",
          characterAction: "",
          expression: "",
          subtitle: "",
          voiceover: "",
          sfx: "",
          bgm: "",
          transition: "",
          editRhythm: "",
        },
        {
          shotNo: 2,
          duration: "3-8s",
          shotSize: "特写",
          cameraMove: "慢推",
          cameraAngle: "俯拍",
          composition: "居中",
          lightingSetup: "顶光",
          toneContrast: "中性",
          visualContent: "面料",
          characterAction: "",
          expression: "",
          subtitle: "",
          voiceover: "",
          sfx: "",
          bgm: "",
          transition: "",
          editRhythm: "",
        },
      ],
      narrativeLogic: "",
      beatPoints: "",
      replicableShootingScript: "",
    };
    const text = `\`\`\`media-decompose\n${JSON.stringify(raw)}\n\`\`\``;
    const patch = extractMediaDecomposePatch(text);
    expect(patch?.mediaType).toBe("video");
    if (patch?.mediaType !== "video") return;
    const overlayed = applyMediaDecomposeAsrOverlay(
      patch,
      buildMediaDecomposeAsrBundle(segments),
    ) as Extract<MediaDecomposePatch, { mediaType: "video" }>;
    expect(overlayed.openingHook.firstFrame).toBe("首帧模特举产品");
    expect(overlayed.openingHook.first3sLines).toBe("这件真的太好穿了");
    expect(overlayed.fullTranscript).toContain("通勤出游都能搭");
    expect(overlayed.storyboardTable[0]?.voiceover).toBe("这件真的太好穿了");
    expect(overlayed.storyboardTable[1]?.voiceover).toBe("面料轻薄透气，上身无负担");
    expect(overlayed.talentAnalysis.appearance).toBe("长发");
    expect(overlayed.wardrobeAnalysis.garments).toBe("针织开衫");
  });

  it("coerces Chinese root keys for opening / talent / wardrobe", () => {
    const raw = {
      mediaType: "video",
      action: "decompose_complete",
      visualStyle: "lookbook",
      globalColorTone: "暖调",
      cameraLanguageSummary: "固定",
      scenePrep: { venue: "棚", fixedProps: "" },
      开场信息: { 首帧: "第0秒举产品", 前三秒完整台词: "你好" },
      完整台词全文: "你好今天好穿",
      模特分析: { 人数: "1人", 外貌: "长发", 表情风格: "对镜", 走位: "站姿" },
      模特服装: { 服装: "开衫", 换装: "全片同一套", 造型要点: "垂感" },
      storyboardTable: [
        {
          shotNo: 1,
          duration: "3s",
          shotSize: "中景",
          cameraMove: "固定",
          cameraAngle: "平视",
          composition: "三分法",
          lightingSetup: "侧顺光",
          toneContrast: "低对比",
          visualContent: "开场",
          characterAction: "",
          expression: "",
          subtitle: "",
          voiceover: "",
          sfx: "",
          bgm: "",
          transition: "",
          editRhythm: "",
        },
      ],
      narrativeLogic: "",
      beatPoints: "",
      replicableShootingScript: "",
    };
    const patch = extractMediaDecomposePatch(
      `\`\`\`media-decompose\n${JSON.stringify(raw)}\n\`\`\``,
    );
    expect(patch?.mediaType).toBe("video");
    if (patch?.mediaType !== "video") return;
    expect(patch.openingHook.firstFrame).toBe("第0秒举产品");
    expect(patch.openingHook.first3sLines).toBe("你好");
    expect(patch.fullTranscript).toBe("你好今天好穿");
    expect(patch.talentAnalysis.appearance).toBe("长发");
    expect(patch.wardrobeAnalysis.garments).toBe("开衫");
  });
});
