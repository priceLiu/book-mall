import { describe, expect, it } from "vitest";
import { preservePro2MediaRowPrompt } from "@/lib/canvas/pro2-media-row-spawn";
import type { StoryProFrameRow } from "@/lib/canvas/story-pro-workspace-types";

describe("preservePro2MediaRowPrompt · frame", () => {
  const pass1Row: StoryProFrameRow = {
    frameIndex: 2,
    key: "2",
    scene: "办公室",
    description: "伏案加班",
    dialogue: "—",
    shotSize: "特写",
    prompt: "",
  };

  it("uses Pass1 script prompt when prev prompt empty", () => {
    const next: StoryProFrameRow = {
      ...pass1Row,
      prompt: "镜 2\n景别：特写\n场景：办公室\n镜头描述：伏案加班",
    };
    const out = preservePro2MediaRowPrompt(undefined, next, "frame");
    expect(out).toContain("镜头描述：伏案加班");
  });

  it("prefers Pass2 frameImagePrompt over empty prev", () => {
    const prev: StoryProFrameRow = { ...pass1Row, prompt: "" };
    const next: StoryProFrameRow = {
      ...pass1Row,
      frameImagePrompt: "特写，@<ref-char-c1> 在办公室伏案。",
      aiImagePrompt: "特写，@<ref-char-c1> 在办公室伏案。",
      prompt: "特写，@<ref-char-c1> 在办公室伏案。",
    };
    expect(preservePro2MediaRowPrompt(prev, next, "frame")).toContain(
      "@<ref-char-c1>",
    );
  });

  it("replaces Pass1 script with Pass2 when frameImagePrompt arrives", () => {
    const prev: StoryProFrameRow = {
      ...pass1Row,
      prompt: "镜 2\n镜头描述：伏案加班",
    };
    const next: StoryProFrameRow = {
      ...pass1Row,
      frameImagePrompt: "润色后的 Pass2 分镜图提示词",
      aiImagePrompt: "润色后的 Pass2 分镜图提示词",
      prompt: "润色后的 Pass2 分镜图提示词",
    };
    expect(preservePro2MediaRowPrompt(prev, next, "frame")).toBe(
      "润色后的 Pass2 分镜图提示词",
    );
  });
});
