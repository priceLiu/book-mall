import { describe, expect, it } from "vitest";

import {
  mergeLibtvAudioRunText,
  resolveLibtvAudioPredecessorTexts,
} from "@/lib/canvas/libtv-audio-run-text";
import type { CanvasFlowEdge, CanvasFlowNode } from "@/lib/canvas/types";

describe("mergeLibtvAudioRunText", () => {
  it("expands @ upstream text into merged dialogue", () => {
    const merged = mergeLibtvAudioRunText(
      "请念：@<up-text-1>",
      [
        {
          id: "up-text-1",
          kind: "text",
          label: "对白",
          previewMd: "你好，世界",
          sourceNodeId: "n1",
        },
      ],
      [],
    );
    expect(merged).toBe("请念：\n\n你好，世界");
  });

  it("joins dock input with predecessor texts", () => {
    const merged = mergeLibtvAudioRunText("旁白", [], ["上游台词"]);
    expect(merged).toBe("旁白\n\n上游台词");
  });
});

describe("resolveLibtvAudioPredecessorTexts", () => {
  it("reads text from upstream text node via in_audio edge", () => {
    const audioId = "audio-1";
    const textId = "text-1";
    const nodes: CanvasFlowNode[] = [
      {
        id: textId,
        type: "text",
        position: { x: 0, y: 0 },
        data: { text: "连接的对白" },
      },
      {
        id: audioId,
        type: "story-pro2-audio",
        position: { x: 200, y: 0 },
        data: {},
      },
    ];
    const edges: CanvasFlowEdge[] = [
      {
        id: "e1",
        source: textId,
        target: audioId,
        targetHandle: "in_audio",
      },
    ];
    expect(resolveLibtvAudioPredecessorTexts(nodes, edges, audioId)).toEqual([
      "连接的对白",
    ]);
  });
});
