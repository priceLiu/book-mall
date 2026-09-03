import { describe, expect, it } from "vitest";

import {
  formatSeedVideoPatchMarkdown,
  toSeedVideoAssistantChatContent,
  extractSeedVideoStructuredPatch,
} from "@/lib/ecom/ecom-seed-video-structured";

const scriptsFence = `\`\`\`seed-video
${JSON.stringify({
  step: "scripts",
  action: "await_script_choice",
  materialAnalysis: {
    productSummary: "挂脖上衣",
    sellingPoints: ["显瘦"],
    sceneTags: ["庭院"],
    styleTone: "种草",
    materials: [{ ref: "@图片1", description: "全身" }],
  },
  scripts: [
    {
      id: "script-1",
      label: "脚本一",
      title: "氛围感切入",
      summary: "逃离喧嚣",
      rows: [
        {
          beatIndex: 1,
          duration: "5s",
          refImageLabel: "@图片1",
          sceneDescription: "门头全身",
          voiceover: "逃离城市的喧嚣",
        },
      ],
    },
    {
      id: "script-2",
      label: "脚本二",
      title: "痛点切入",
      summary: "显瘦",
      rows: [
        {
          beatIndex: 1,
          duration: "5s",
          refImageLabel: "@图片2",
          sceneDescription: "镜子",
          voiceover: "挂脖显瘦",
        },
      ],
    },
    {
      id: "script-3",
      label: "脚本三",
      title: "场景切入",
      summary: "走路",
      rows: [
        {
          beatIndex: 1,
          duration: "6s",
          refImageLabel: "@图片3",
          sceneDescription: "行走",
          voiceover: "走路就是风景",
        },
      ],
    },
  ],
})}
\`\`\``;

describe("seed-video JSON-only display", () => {
  it("extracts scripts patch from fence-only reply", () => {
    const patch = extractSeedVideoStructuredPatch(scriptsFence);
    expect(patch?.step).toBe("scripts");
    expect(patch?.scripts?.length).toBe(3);
  });

  it("renders assistant chat from JSON without model Markdown", () => {
    const md = toSeedVideoAssistantChatContent(scriptsFence);
    expect(md).toContain("## 素材解析");
    expect(md).toContain("## 脚本一：氛围感切入");
    expect(md).toContain("逃离城市的喧嚣");
    expect(md).toContain("请选择脚本：");
    expect(md).not.toContain("```seed-video");
  });

  it("renders mode options from JSON", () => {
    const text = `\`\`\`seed-video
${JSON.stringify({
  step: "mode",
  action: "await_mode_choice",
  modeOptions: [
    { id: "direct", label: "方案①：直接连贯生成视频", description: "快" },
    { id: "fine", label: "方案②：按精细成片流程制作", description: "细" },
  ],
})}
\`\`\``;
    const md = formatSeedVideoPatchMarkdown(extractSeedVideoStructuredPatch(text)!);
    expect(md).toContain("方案①：直接连贯生成视频");
    expect(md).toContain("请选择视频制作模式：");
  });

  it("renders formalShots from JSON", () => {
    const text = `\`\`\`seed-video
${JSON.stringify({
  step: "formalShots",
  action: "await_formal_shots_confirm",
  shots: [
    {
      index: 1,
      timeSlice: "0-5s",
      refImageLabel: "@图片1",
      sceneDescription: "推镜",
      videoPrompt: "参考@图片1",
      voiceover: "姐妹们",
      durationSec: 5,
    },
  ],
  configTable: {
    globalPrompt: "9:16",
    fullVoiceover: "姐妹们…",
    voiceTone: "女声",
    bgmPreset: "轻快",
    durationSec: 20,
    aspectRatio: "9:16",
    materialUsage: "@图片1",
  },
})}
\`\`\``;
    const md = toSeedVideoAssistantChatContent(text);
    expect(md).toContain("正式脚本");
    expect(md).toContain("参考@图片1");
    expect(md).toContain("请确认逐镜参数表：");
  });
});
