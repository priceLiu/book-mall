import { describe, expect, it } from "vitest";

import { buildImageDecomposeDraftImagePrompt, buildReplicaShotsFromDecompose } from "@/lib/ecom/ecom-media-decompose-replica";
import {
  buildReplicaProductRecognizePrompt,
  buildReplicaScriptSystemPrompt,
  finalizeImageReplicaScriptShots,
  pickReplicaPromptPreservingDensity,
} from "@/lib/ecom/ecom-media-decompose-replica-script";
import type { MediaDecomposePatch } from "@/lib/ecom/ecom-media-decompose-structured";
import type { SeedVideoReference } from "@/lib/ecom/ecom-seed-video-types";

const ref: SeedVideoReference = {
  id: "ref-replica-model-draft",
  label: "@图片1",
  role: "seed-material",
  ossUrl: "",
};

const baseVideoPatch = {
  visualStyle: "低饱和莫兰迪 lookbook",
  globalColorTone: "暖金侧光",
  cameraLanguageSummary: "镜1推镜；镜2固定",
  scenePrep: { venue: "室内棚", fixedProps: "展示台" },
  openingHook: { firstFrame: "", first3sLines: "" },
  fullTranscript: "",
  talentAnalysis: { count: "", appearance: "", expressionStyle: "", blocking: "" },
  wardrobeAnalysis: { garments: "", changes: "", stylingNotes: "" },
  narrativeLogic: "",
  beatPoints: "",
  replicableShootingScript: "",
} as const;

describe("buildReplicaShotsFromDecompose", () => {
  it("maps image decompose into separate imagePrompt and videoPrompt", () => {
    const structured: MediaDecomposePatch = {
      mediaType: "image",
      action: "decompose_complete",
      elements: {
        subject: "模特展示针织开衫",
        subjectPose: "侧身站立",
        sceneEnvironment: "室内棚拍",
        composition: "三分法构图",
        colorSystem: "暖金色调",
        atmosphere: "lookbook 氛围",
        lighting: {
          keyLight: "柔光",
          fillLight: "辅光",
          rimLight: "",
          ambientLight: "",
          direction: "侧顺光",
          hardSoft: "软光",
          colorTemperature: "暖色温",
        },
      },
      positivePrompt: "lookbook 针织开衫，柔光侧顺光，暖金色调",
      negativePrompt: "",
      liveActionReplication: {
        sceneSetup: "室内棚",
        talentBlocking: "模特居中",
        compositionFraming: "半身构图",
        cameraPlacement: "平视机位",
        lightingSetup: "柔光箱侧顺",
        props: "无",
        cameraParams: "50mm",
        postProcessing: "低饱和",
        shootingChecklist: "步骤一",
      },
    };

    const [shot] = buildReplicaShotsFromDecompose(structured, ref);

    expect(shot.imagePrompt).toContain("lookbook 针织开衫，柔光侧顺光，暖金色调");
    expect(shot.imagePrompt).toContain("三分法构图");
    expect(shot.imagePrompt).toContain("50mm");
    expect(shot.imagePrompt).toContain("室内棚");
    expect(shot.imagePrompt.length).toBeGreaterThan(structured.positivePrompt.length);
    expect(shot.videoPrompt).not.toBe(shot.imagePrompt);
    expect(shot.videoPrompt).toContain("缓慢推镜");
    expect(shot.videoPrompt).toContain("暖金色调");
    expect(shot.videoPrompt).toContain("50mm");
    expect(shot.videoPrompt).toContain("室内棚");
  });

  it("maps non-voiceover storyboard fields into videoPrompt", () => {
    const structured: MediaDecomposePatch = {
      mediaType: "video",
      action: "decompose_complete",
      ...baseVideoPatch,
      storyboardTable: [
        {
          shotNo: 1,
          duration: "3s",
          shotSize: "中景",
          cameraMove: "推镜",
          cameraAngle: "平视",
          composition: "三分法",
          lightingSetup: "柔光侧顺光",
          toneContrast: "低对比自然光",
          visualContent: "模特展示包包",
          characterAction: "转身",
          expression: "微笑",
          subtitle: "限时特惠字幕",
          voiceover: "这是配音台词",
          sfx: "快门声",
          bgm: "轻快电子",
          transition: "硬切",
          editRhythm: "卡点",
        },
      ],
    };

    const [shot] = buildReplicaShotsFromDecompose(structured, ref);

    expect(shot.videoPrompt).toContain("低饱和莫兰迪 lookbook");
    expect(shot.videoPrompt).toContain("暖金侧光");
    expect(shot.videoPrompt).toContain("中景");
    expect(shot.videoPrompt).toContain("推镜");
    expect(shot.videoPrompt).toContain("柔光侧顺光");
    expect(shot.videoPrompt).toContain("低对比自然光");
    expect(shot.videoPrompt).toContain("快门声");
    expect(shot.videoPrompt).toContain("轻快电子");
    expect(shot.videoPrompt).toContain("硬切");
    expect(shot.videoPrompt).toContain("卡点");
    expect(shot.videoPrompt).not.toContain("限时特惠字幕");
    expect(shot.videoPrompt).not.toContain("这是配音台词");
    expect(shot.voiceover).toBe("这是配音台词");
  });

  it("falls back voiceover to subtitle when voiceover empty", () => {
    const structured: MediaDecomposePatch = {
      mediaType: "video",
      action: "decompose_complete",
      ...baseVideoPatch,
      storyboardTable: [
        {
          shotNo: 1,
          duration: "4s",
          shotSize: "特写",
          cameraMove: "固定",
          cameraAngle: "俯拍",
          composition: "居中",
          lightingSetup: "顶光",
          toneContrast: "高对比",
          visualContent: "产品细节",
          characterAction: "",
          expression: "",
          subtitle: "仅字幕口播",
          voiceover: "",
          sfx: "",
          bgm: "",
          transition: "",
          editRhythm: "",
        },
      ],
    };

    const [shot] = buildReplicaShotsFromDecompose(structured, ref);
    expect(shot.voiceover).toBe("仅字幕口播");
    expect(shot.videoPrompt).not.toContain("仅字幕口播");
  });
});

describe("pickReplicaPromptPreservingDensity", () => {
  it("falls back to draft when LLM over-compresses", () => {
    const draft = "A".repeat(200);
    expect(pickReplicaPromptPreservingDensity("短句", draft, 0.75)).toBe(draft);
    expect(pickReplicaPromptPreservingDensity("B".repeat(160), draft, 0.75)).toBe("B".repeat(160));
  });
});

describe("finalizeImageReplicaScriptShots", () => {
  it("restores full draft imagePrompt when script imagePrompt is too short", () => {
    const structured: MediaDecomposePatch = {
      mediaType: "image",
      action: "decompose_complete",
      elements: {
        subject: "模特",
        subjectPose: "站立",
        sceneEnvironment: "棚拍",
        composition: "三分法",
        colorSystem: "暖色",
        atmosphere: "lookbook",
        lighting: {
          keyLight: "柔光",
          fillLight: "",
          rimLight: "",
          ambientLight: "",
          direction: "侧光",
          hardSoft: "软",
          colorTemperature: "5500K",
        },
      },
      positivePrompt: "完整生图 Prompt ".repeat(20).trim(),
      negativePrompt: "",
      liveActionReplication: {
        sceneSetup: "棚",
        talentBlocking: "居中",
        compositionFraming: "半身",
        cameraPlacement: "平视",
        lightingSetup: "柔光箱",
        props: "无",
        cameraParams: "50mm f/4",
        postProcessing: "低饱和",
        shootingChecklist: "步骤",
      },
    };
    const draftImage = buildImageDecomposeDraftImagePrompt(structured);
    const [finalized] = finalizeImageReplicaScriptShots(structured, [
      {
        index: 1,
        timeSlice: "0-5s",
        refImageId: "r1",
        refImageLabel: "@图片1",
        sceneDescription: "场景",
        imagePrompt: "过短的 LLM 输出",
        videoPrompt: "短",
        voiceover: "",
        durationSec: 5,
      },
    ]);
    expect(finalized.imagePrompt).toBe(draftImage);
    expect(finalized.imagePrompt.length).toBeGreaterThan(structured.positivePrompt.length);
    expect(finalized.videoPrompt.length).toBeGreaterThan(20);
  });
});

describe("buildReplicaScriptSystemPrompt", () => {
  it("requires imagePrompt for image decompose replica script", () => {
    const prompt = buildReplicaScriptSystemPrompt([], { mediaType: "image" });
    expect(prompt).toMatch(/imagePrompt/);
    expect(prompt).toMatch(/不得.*与 imagePrompt 逐字相同/);
  });

  it("requires sfx/bgm in videoPrompt and keeps voiceover separate", () => {
    const prompt = buildReplicaScriptSystemPrompt([]);
    expect(prompt).toMatch(/videoPrompt 与 voiceover \*\*严格分离\*\*/);
    expect(prompt).toMatch(/音效\/BGM\/转场\/剪辑/);
    expect(prompt).toMatch(/禁止.*videoPrompt/);
  });

  it("requires inheriting lighting tone and camera language", () => {
    const prompt = buildReplicaScriptSystemPrompt([]);
    expect(prompt).toMatch(/布光、影调、全片色调与视觉风格/);
    expect(prompt).toMatch(/不得删减.*光影/);
    expect(prompt).toMatch(/cameraMove 不得弱化/);
  });

  it("forbids json fence alias in machine contract", () => {
    const prompt = buildReplicaScriptSystemPrompt([]);
    expect(prompt).toMatch(/禁止.*json/);
    expect(prompt).toMatch(/最末尾.*replica-script/);
  });
});

describe("buildReplicaProductRecognizePrompt", () => {
  it("includes user draft for polish mode", () => {
    const prompt = buildReplicaProductRecognizePrompt(2, "手工写的卖点草稿");
    expect(prompt).toContain("共 2 张产品图");
    expect(prompt).toContain("手工写的卖点草稿");
    expect(prompt).toContain("润色");
  });
});
