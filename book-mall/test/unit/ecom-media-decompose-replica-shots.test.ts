import { describe, expect, it } from "vitest";

import { buildReplicaShotsFromDecompose } from "@/lib/ecom/ecom-media-decompose-replica";
import {
  buildReplicaProductRecognizePrompt,
  buildReplicaScriptSystemPrompt,
} from "@/lib/ecom/ecom-media-decompose-replica-script";
import type { MediaDecomposePatch } from "@/lib/ecom/ecom-media-decompose-structured";
import type { SeedVideoReference } from "@/lib/ecom/ecom-seed-video-types";

const ref: SeedVideoReference = {
  id: "ref-replica-model-draft",
  label: "@图片1",
  role: "seed-material",
  ossUrl: "",
};

describe("buildReplicaShotsFromDecompose", () => {
  it("maps non-voiceover storyboard fields into videoPrompt", () => {
    const structured: MediaDecomposePatch = {
      mediaType: "video",
      action: "decompose_complete",
      storyboardTable: [
        {
          shotNo: 1,
          duration: "3s",
          shotSize: "中景",
          cameraMove: "推镜",
          cameraAngle: "平视",
          composition: "三分法",
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
      narrativeLogic: "",
      beatPoints: "",
      replicableShootingScript: "",
    };

    const [shot] = buildReplicaShotsFromDecompose(structured, ref);

    expect(shot.videoPrompt).toContain("中景");
    expect(shot.videoPrompt).toContain("推镜");
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
      storyboardTable: [
        {
          shotNo: 1,
          duration: "4s",
          shotSize: "特写",
          cameraMove: "固定",
          cameraAngle: "俯拍",
          composition: "居中",
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
      narrativeLogic: "",
      beatPoints: "",
      replicableShootingScript: "",
    };

    const [shot] = buildReplicaShotsFromDecompose(structured, ref);
    expect(shot.voiceover).toBe("仅字幕口播");
    expect(shot.videoPrompt).not.toContain("仅字幕口播");
  });
});

describe("buildReplicaScriptSystemPrompt", () => {
  it("requires sfx/bgm in videoPrompt and keeps voiceover separate", () => {
    const prompt = buildReplicaScriptSystemPrompt([]);
    expect(prompt).toMatch(/videoPrompt 与 voiceover 严格分离/);
    expect(prompt).toMatch(/音效、BGM、转场、剪辑节奏/);
    expect(prompt).toMatch(/禁止写入字幕文案、配音台词/);
    expect(prompt).toMatch(/禁止写入 videoPrompt/);
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
