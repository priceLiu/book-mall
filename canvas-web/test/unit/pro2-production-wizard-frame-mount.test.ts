import { describe, expect, it } from "vitest";
import {
  convertWizardMentionTokensToDockRefs,
  finalizePro2FrameRowsForCanvasMount,
} from "@/lib/canvas/pro2-production-wizard-frame-mount";
import { syncPro2FrameRowUpstreamRefs } from "@/lib/canvas/pro2-wire-frame-board-refs";
import { mergeFrameRowCharacterRefsFromIds } from "@/lib/canvas/story-column-sync";
import type { Pro2ProductionScript } from "@/lib/canvas/data/pro2-production-script-schema";
import type {
  StoryProCharacterRow,
  StoryProFrameRow,
  StoryProSceneRow,
} from "@/lib/canvas/story-pro-workspace-types";

const script: Pro2ProductionScript = {
  schemaVersion: 2,
  characters: [{ id: "c1", name: "沈昭昭", role: "主角", appearance: "", imagePrompt: "" }],
  scenes: [{ id: "s1", name: "办公室", environmentTimeMood: "深夜", imagePrompt: "" }],
  shots: [{ index: 1, sceneDescription: "伏案", dialogue: "—", characterIds: ["c1"], sceneId: "s1" }],
};

describe("pro2-production-wizard-frame-mount", () => {
  it("convertWizardMentionTokensToDockRefs maps wiz tokens to dock refs", () => {
    const out = convertWizardMentionTokensToDockRefs(
      "特写 @<wiz-char-c1> 在 @<wiz-scene-s1>",
      script,
      "hub-1",
      [{ key: "hub-1::办公室", name: "办公室" } as StoryProSceneRow],
    );
    expect(out).toContain("@<ref-char-c1>");
    expect(out).toContain("@<ref-scene-hub-1::办公室>");
  });

  it("mergeFrameRowCharacterRefsFromIds + sync keeps ref-char in refImages", () => {
    const characterRows: StoryProCharacterRow[] = [
      {
        key: "c1",
        name: "沈昭昭",
        runtime: { status: "done", ossUrl: "https://cdn.example/c1.png" },
      },
    ];
    const merged = mergeFrameRowCharacterRefsFromIds(
      {
        frameIndex: 1,
        key: "1",
        scene: "办公室",
        description: "伏案",
        dialogue: "—",
        shotSize: "特写",
        prompt: "镜头描述：伏案",
      },
      characterRows,
      ["c1"],
    );
    expect(merged.referencedNodeIds).toContain("ref-char-c1");
    const synced = syncPro2FrameRowUpstreamRefs(
      merged,
      characterRows,
      [{ key: "hub-1::办公室", name: "办公室" }],
      [],
    );
    expect(synced.prompt).toMatch(/@<ref-char-c1>/);
    expect(synced.refImages?.some((r) => r.id === "ref-char-c1")).toBe(true);
  });

  it("finalizePro2FrameRowsForCanvasMount fills Pass1 prompt and refs", () => {
    const characterRows: StoryProCharacterRow[] = [
      {
        key: "c1",
        name: "沈昭昭",
        runtime: { status: "done", ossUrl: "https://cdn.example/c1.png" },
      },
    ];
    const frameRows: StoryProFrameRow[] = [
      {
        frameIndex: 1,
        key: "1",
        scene: "办公室",
        description: "伏案",
        dialogue: "—",
        shotSize: "特写",
        prompt: "",
      },
    ];
    const out = finalizePro2FrameRowsForCanvasMount({
      frameRows,
      characterRows,
      sceneRows: [{ key: "hub-1::办公室", name: "办公室" }],
      script,
      scriptHubId: "hub-1",
    });
    expect(out[0]?.prompt).toContain("镜头描述：伏案");
    expect(out[0]?.refImages?.some((r) => r.id === "ref-char-c1")).toBe(true);
  });
});
