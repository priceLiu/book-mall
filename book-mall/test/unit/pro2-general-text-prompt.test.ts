import { describe, expect, it } from "vitest";

import { composeStoryProGeneralTextUserPrompt } from "@/lib/canvas/pro2-general-text-prompt";

describe("composeStoryProGeneralTextUserPrompt", () => {
  it("puts the dock instruction before referenced upstream text", () => {
    const prompt = composeStoryProGeneralTextUserPrompt({
      themeInput:
        "Extract Pose 1 from the received text.\n输出请转换为中文",
      textInputs: ["Pose 1: arms raised\nPose 2: sitting"],
    });
    expect(prompt.startsWith("Extract Pose 1 from the received text.")).toBe(
      true,
    );
    expect(prompt).toContain("输出请转换为中文");
    expect(prompt).toContain("以下为引用的上游文本：");
    expect(prompt).toContain("Pose 1: arms raised");
  });

  it("does not drop the instruction when upstream is also present", () => {
    const prompt = composeStoryProGeneralTextUserPrompt({
      themeInput: "只输出 Pose 1",
      textInputs: ["很长的上游三视图正文……"],
    });
    expect(prompt.indexOf("只输出 Pose 1")).toBeLessThan(
      prompt.indexOf("很长的上游三视图正文"),
    );
  });

  it("falls back to upstream when dock instruction is empty", () => {
    expect(
      composeStoryProGeneralTextUserPrompt({
        themeInput: "  ",
        textInputs: ["上游正文"],
      }),
    ).toBe("上游正文");
  });
});
