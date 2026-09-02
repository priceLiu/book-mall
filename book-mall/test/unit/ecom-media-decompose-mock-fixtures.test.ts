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

  it("enriches voiceover from markdown table when JSON voiceover empty", () => {
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
          visualContent: "模特展示",
          characterAction: "转身",
          expression: "微笑",
          subtitle: "",
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
    const text = [
      "## 分镜拆解表",
      "",
      "| 镜号 | 时长 | 景别 | 运镜 | 镜头角度 | 构图方式 | 画面内容 | 人物动作 | 表情 | 字幕文案 | 口播文案 | 音效 | BGM | 转场 | 剪辑节奏 |",
      "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
      "| 1 | 3s | 中景 | 固定 | 平视 | 三分法 | 模特展示 | 转身 | 微笑 |  | 这件真的太好穿了 |  |  | 切 | 快 |",
      "",
      "```media-decompose",
      JSON.stringify(raw),
      "```",
    ].join("\n");
    const patch = extractMediaDecomposePatch(text);
    expect(patch?.mediaType).toBe("video");
    if (patch?.mediaType === "video") {
      expect(patch.storyboardTable[0]?.voiceover).toBe("这件真的太好穿了");
    }
  });
});
