import { describe, expect, it, vi } from "vitest";
import type { Pro2ProductionScript } from "@/lib/canvas/data/pro2-production-script-schema";
import type { StoryProScriptHubNodeData } from "@/lib/canvas/story-pro-workspace-types";
import { persistWizardShotPromptsToHub } from "@/lib/canvas/pro2-wizard-shot-prompt-polish-run";

const script: Pro2ProductionScript = {
  schemaVersion: 2,
  shots: [
    {
      index: 1,
      sceneDescription: "沈昭昭伏案加班",
      dialogue: "—",
      durationSec: 10,
      characterIds: ["c1"],
      sceneId: "s1",
    },
  ],
  characters: [{
    id: "c1",
    name: "现代沈昭昭",
    role: "女主",
    appearance: "待补充",
    imagePrompt: "名称：现代沈昭昭",
  }],
  scenes: [{
    id: "s1",
    name: "现代办公室",
    environmentTimeMood: "深夜",
    imagePrompt: "名称：现代办公室",
  }],
};

describe("persistWizardShotPromptsToHub", () => {
  it("writes frame/video prompts into productionScript and frame rows", () => {
    const hubData: StoryProScriptHubNodeData = {
      productionScript: script,
      scriptStudioFrameRows: [],
    };
    const updates: Array<{ id: string; patch: Record<string, unknown> }> = [];
    const updateNodeData = vi.fn((id: string, patch: Record<string, unknown>) => {
      updates.push({ id, patch });
    });

    persistWizardShotPromptsToHub({
      scriptHubId: "hub-1",
      hubData,
      script,
      shotIndex: 1,
      frameImagePrompt: "特写，现代沈昭昭在现代办公室伏案。",
      videoPrompt: "出场角色：现代沈昭昭",
      updateNodeData,
    });

    expect(updateNodeData).toHaveBeenCalled();
    const hubPatch = updates.find((u) => u.id === "hub-1")?.patch as
      | StoryProScriptHubNodeData
      | undefined;
    const shot = hubPatch?.productionScript?.shots?.[0];
    expect(shot?.frameImagePrompt).toContain("@<wiz-char-c1>");
    expect(shot?.videoPrompt).toContain("@<wiz-char-c1>");
    const frameRow = hubPatch?.scriptStudioFrameRows?.find(
      (r) => r.frameIndex === 1,
    );
    expect(
      frameRow?.frameImagePrompt?.trim() || frameRow?.prompt?.trim(),
    ).toBeTruthy();
  });
});
