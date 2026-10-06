import { describe, expect, it } from "vitest";

import { resolveLibtvVideoTrimWorkbench } from "@/lib/canvas/libtv-video-compose-workbench";

describe("libtv-video-compose-workbench", () => {
  it("restores persisted in/out after reopen", () => {
    const nodeId = "video-node-1";
    const url = "https://cdn.example/v.mp4";
    const persisted = resolveLibtvVideoTrimWorkbench({
      nodeId,
      sourceVideoUrl: url,
      label: "V",
      nodes: [],
      edges: [],
      persisted: null,
    });
    const trimmed = {
      ...persisted,
      clips: persisted.clips.map((c) =>
        c.id === nodeId
          ? { ...c, sourceStartSec: 0, sourceEndSec: 4.5, durationSec: 4.5 }
          : c,
      ),
    };
    const restored = resolveLibtvVideoTrimWorkbench({
      nodeId,
      sourceVideoUrl: url,
      label: "V",
      nodes: [],
      edges: [],
      persisted: trimmed,
    });
    const root = restored.clips.find((c) => c.id === nodeId);
    expect(root?.sourceEndSec).toBe(4.5);
    expect(root?.durationSec).toBe(4.5);
  });

  it("keeps split segments when upstream url unchanged", () => {
    const nodeId = "video-node-1";
    const url = "https://cdn.example/v.mp4";
    const base = resolveLibtvVideoTrimWorkbench({
      nodeId,
      sourceVideoUrl: url,
      label: "V",
      nodes: [],
      edges: [],
      persisted: null,
    });
    const split = {
      ...base,
      orderedClipIds: ["a", "b"],
      clips: [
        {
          id: "a",
          videoUrl: url,
          label: "A",
          source: "import" as const,
          sourceStartSec: 0,
          sourceEndSec: 2,
          durationSec: 2,
        },
        {
          id: "b",
          videoUrl: url,
          label: "B",
          source: "import" as const,
          sourceStartSec: 2,
          sourceEndSec: 5,
          durationSec: 3,
        },
      ],
    };
    const restored = resolveLibtvVideoTrimWorkbench({
      nodeId,
      sourceVideoUrl: url,
      label: "V",
      nodes: [],
      edges: [],
      persisted: split,
    });
    expect(restored.orderedClipIds).toEqual(["a", "b"]);
    expect(restored.clips).toHaveLength(2);
  });
});
