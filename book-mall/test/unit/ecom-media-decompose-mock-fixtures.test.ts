import { describe, expect, it } from "vitest";

import {
  MOCK_MEDIA_DECOMPOSE_IMAGE_PATCH,
  MOCK_MEDIA_DECOMPOSE_VIDEO_PATCH,
  mockMediaDecomposePatchForKind,
} from "@/lib/ecom/ecom-media-decompose-mock-fixtures";
import { extractMediaDecomposePatch } from "@/lib/ecom/ecom-media-decompose-structured";

describe("media-decompose mock fixtures", () => {
  it("video fixture parses from fence", () => {
    const text = `\`\`\`media-decompose\n${JSON.stringify(MOCK_MEDIA_DECOMPOSE_VIDEO_PATCH)}\n\`\`\``;
    const patch = extractMediaDecomposePatch(text);
    expect(patch?.mediaType).toBe("video");
    expect(patch && "storyboardTable" in patch && patch.storyboardTable.length).toBe(3);
  });

  it("image fixture parses from fence", () => {
    const text = `\`\`\`media-decompose\n${JSON.stringify(MOCK_MEDIA_DECOMPOSE_IMAGE_PATCH)}\n\`\`\``;
    const patch = extractMediaDecomposePatch(text);
    expect(patch?.mediaType).toBe("image");
    expect(patch && "positivePrompt" in patch && patch.positivePrompt.length).toBeGreaterThan(0);
  });

  it("fills voiceover from subtitle when voiceover empty", () => {
    const raw = {
      mediaType: "video",
      action: "decompose_complete",
      visualStyle: "带货 lookbook",
      globalColorTone: "暖调",
      cameraLanguageSummary: "固定",
      scenePrep: { venue: "", fixedProps: "" },
      storyboardTable: [
        {
          shotNo: 1,
          duration: "3s",
          shotSize: "中景",
          cameraMove: "固定",
          cameraAngle: "平视",
          composition: "三分法",
          visualContent: "模特展示",
          characterAction: "转身",
          expression: "微笑",
          subtitle: "夏季必备针织开衫",
          voiceover: "",
          sfx: "",
          bgm: "",
          transition: "切",
          editRhythm: "快",
        },
      ],
      narrativeLogic: "",
      beatPoints: "",
      replicableShootingScript: "",
    };
    const text = `\`\`\`media-decompose\n${JSON.stringify(raw)}\n\`\`\``;
    const patch = extractMediaDecomposePatch(text);
    expect(patch?.mediaType).toBe("video");
    if (patch?.mediaType === "video") {
      expect(patch.storyboardTable[0]?.voiceover).toBe("夏季必备针织开衫");
    }
  });

  it("mockMediaDecomposePatchForKind matches media kind", () => {
    expect(mockMediaDecomposePatchForKind("video").mediaType).toBe("video");
    expect(mockMediaDecomposePatchForKind("image").mediaType).toBe("image");
  });

  it("maps Chinese JSON keys to voiceover", () => {
    const raw = {
      mediaType: "video",
      action: "decompose_complete",
      visualStyle: "纪实风格",
      globalColorTone: "自然光",
      cameraLanguageSummary: "固定",
      scenePrep: { venue: "", fixedProps: "" },
      storyboardTable: [
        {
          镜号: 1,
          时长: "3s",
          景别: "中景",
          运镜: "固定",
          镜头角度: "平视",
          构图方式: "三分法",
          画面内容: "模特展示",
          人物动作: "转身",
          表情: "微笑",
          字幕文案: "夏季必备",
          配音台词: "这件针织开衫真的太好穿了",
          音效: "",
          BGM: "",
          转场: "切",
          剪辑节奏: "快",
        },
      ],
      narrativeLogic: "",
      beatPoints: "",
      replicableShootingScript: "",
    };
    const text = `\`\`\`media-decompose\n${JSON.stringify(raw)}\n\`\`\``;
    const patch = extractMediaDecomposePatch(text);
    expect(patch?.mediaType).toBe("video");
    if (patch?.mediaType === "video") {
      expect(patch.storyboardTable[0]?.voiceover).toBe("这件针织开衫真的太好穿了");
      expect(patch.storyboardTable[0]?.subtitle).toBe("夏季必备");
    }
  });

  it("maps nested audioInfo to voiceover", () => {
    const raw = {
      mediaType: "video",
      action: "decompose_complete",
      visualStyle: "lookbook",
      globalColorTone: "暖金",
      cameraLanguageSummary: "固定",
      scenePrep: { venue: "", fixedProps: "" },
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
          visualContent: "模特展示",
          characterAction: "转身",
          expression: "微笑",
          subtitle: "夏季必备",
          voiceover: "",
          audioInfo: { voiceover: "这件真的太好穿了" },
          sfx: "",
          bgm: "",
          transition: "切",
          editRhythm: "快",
        },
      ],
      narrativeLogic: "",
      beatPoints: "",
      replicableShootingScript: "",
    };
    const text = `\`\`\`media-decompose\n${JSON.stringify(raw)}\n\`\`\``;
    const patch = extractMediaDecomposePatch(text);
    if (patch?.mediaType === "video") {
      expect(patch.storyboardTable[0]?.voiceover).toBe("这件真的太好穿了");
      expect(patch.storyboardTable[0]?.subtitle).toBe("夏季必备");
    }
  });

  it("rejects video patch when global visual fields missing", () => {
    const raw = {
      mediaType: "video",
      action: "decompose_complete",
      storyboardTable: [
        {
          shotNo: 1,
          duration: "3s",
          shotSize: "中景",
          cameraMove: "固定",
          cameraAngle: "平视",
          composition: "三分法",
          visualContent: "模特",
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
    expect(extractMediaDecomposePatch(text)).toBeNull();
  });

  it("maps 旁白 Chinese key to voiceover", () => {
    const raw = {
      mediaType: "video",
      action: "decompose_complete",
      visualStyle: "纪实风格",
      globalColorTone: "自然光",
      cameraLanguageSummary: "固定",
      scenePrep: { venue: "", fixedProps: "" },
      storyboardTable: [
        {
          镜号: 1,
          时长: "3s",
          景别: "中景",
          运镜: "固定",
          镜头角度: "平视",
          构图方式: "三分法",
          布光: "柔光",
          影调: "自然",
          画面内容: "模特展示",
          人物动作: "转身",
          表情: "微笑",
          字幕文案: "夏季必备",
          旁白: "这件针织开衫真的太好穿了",
          音效: "",
          BGM: "",
          转场: "切",
          剪辑节奏: "快",
        },
      ],
      narrativeLogic: "",
      beatPoints: "",
      replicableShootingScript: "",
    };
    const text = `\`\`\`media-decompose\n${JSON.stringify(raw)}\n\`\`\``;
    const patch = extractMediaDecomposePatch(text);
    if (patch?.mediaType === "video") {
      expect(patch.storyboardTable[0]?.voiceover).toBe("这件针织开衫真的太好穿了");
    }
  });

  it("coerces Chinese lighting keys on storyboard rows", () => {
    const raw = {
      mediaType: "video",
      action: "decompose_complete",
      visualStyle: "商业短片",
      globalColorTone: "高饱和",
      cameraLanguageSummary: "横移",
      scenePrep: { venue: "海滩", fixedProps: "伞" },
      storyboardTable: [
        {
          镜号: 1,
          时长: "3s",
          景别: "中景",
          运镜: "横移跟拍",
          镜头角度: "平视",
          构图方式: "三分法",
          布光: "侧顺光",
          影调: "高对比",
          画面内容: "模特",
          人物动作: "",
          表情: "",
          字幕文案: "",
          口播: "",
          音效: "",
          BGM: "",
          转场: "",
          剪辑节奏: "",
        },
        {
          镜号: 2,
          时长: "3s",
          景别: "特写",
          运镜: "固定",
          镜头角度: "俯拍",
          构图方式: "居中",
          布光: "柔光",
          影调: "低饱和",
          画面内容: "产品",
          人物动作: "",
          表情: "",
          字幕文案: "",
          口播: "",
          音效: "",
          BGM: "",
          转场: "",
          剪辑节奏: "",
        },
      ],
      narrativeLogic: "",
      beatPoints: "",
      replicableShootingScript: "",
    };
    const text = `\`\`\`media-decompose\n${JSON.stringify(raw)}\n\`\`\``;
    const patch = extractMediaDecomposePatch(text);
    expect(patch?.mediaType).toBe("video");
    if (patch?.mediaType === "video") {
      expect(patch.storyboardTable[0]?.lightingSetup).toBe("侧顺光");
      expect(patch.storyboardTable[0]?.toneContrast).toBe("高对比");
    }
  });
});
