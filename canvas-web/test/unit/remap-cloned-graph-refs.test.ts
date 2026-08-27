import { describe, expect, it } from "vitest";

import { cloneGraphForDuplicate } from "@/lib/canvas/clone";
import {
  clonedPromptMentionIdsStillValid,
  remapMentionRefId,
  remapMentionTokensInString,
} from "@/lib/canvas/remap-cloned-graph-refs";
import type { CanvasGraph } from "@/lib/canvas/types";

describe("remap-cloned-graph-refs", () => {
  it("remaps sbv1-ref mention tokens to new node ids", () => {
    const idMap = new Map([
      ["n_oldimg01", "n_newimg99"],
      ["n_oldvid01", "n_newvid88"],
    ]);
    const prompt = "镜头 @<sbv1-ref-n_oldimg01> 推进，参考 @<sbv1-text-n_oldvid01>";
    expect(remapMentionTokensInString(prompt, idMap)).toBe(
      "镜头 @<sbv1-ref-n_newimg99> 推进，参考 @<sbv1-text-n_newvid88>",
    );
  });

  it("remaps mention ref id helper", () => {
    const idMap = new Map([["n_aaa", "n_bbb"]]);
    expect(remapMentionRefId("sbv1-ref-n_aaa", idMap)).toBe("sbv1-ref-n_bbb");
    expect(remapMentionRefId("ref-char-c1", idMap)).toBe("ref-char-c1");
  });

  it("cloneGraphForDuplicate rewrites video prompt @ refs for dock chips", () => {
    const graph: CanvasGraph = {
      nodes: [
        {
          id: "n_img001",
          type: "sbv1-image",
          position: { x: 0, y: 0 },
          data: { ossUrl: "https://oss/a.png" },
        },
        {
          id: "n_vid001",
          type: "sbv1-video-engine",
          position: { x: 400, y: 0 },
          data: {
            prompt: "运动 @<sbv1-ref-n_img001>",
            dockInput: "运动 @<sbv1-ref-n_img001>",
          },
        },
      ],
      edges: [
        {
          id: "e_1",
          source: "n_img001",
          target: "n_vid001",
          targetHandle: "in_ref",
        },
      ],
    };
    const dup = cloneGraphForDuplicate(graph);
    const video = dup.nodes.find((n) => n.type === "sbv1-video-engine");
    const image = dup.nodes.find((n) => n.type === "sbv1-image");
    expect(image?.id).not.toBe("n_img001");
    const prompt = String((video?.data as { prompt?: string }).prompt ?? "");
    expect(prompt).toContain(`@<sbv1-ref-${image!.id}>`);
    expect(prompt).not.toContain("n_img001");
    const dupIdMap = new Map(
      graph.nodes.map((n, i) => [n.id, dup.nodes[i]!.id] as const),
    );
    expect(clonedPromptMentionIdsStillValid(prompt, dupIdMap)).toBe(true);
  });
});

describe("cloneGraphForDuplicate auto-render", () => {
  it("clears mediaRenderInFlight on duplicate", () => {
    const graph: CanvasGraph = {
      nodes: [
        {
          id: "n_auto01",
          type: "jianying-auto-render-pro2",
          position: { x: 0, y: 0 },
          data: {
            videoUrl: "https://oss/old.mp4",
            mediaRenderInFlight: { jobId: "job_1", status: "RUNNING" },
            mediaRenderResult: {
              downloadUrl: "https://oss/old.mp4",
              expiresAt: "2099-01-01T00:00:00.000Z",
            },
          },
        },
      ],
      edges: [],
    };
    const dup = cloneGraphForDuplicate(graph);
    const d = dup.nodes[0]!.data as {
      mediaRenderInFlight?: unknown;
      videoUrl?: string;
    };
    expect(d.mediaRenderInFlight).toBeUndefined();
    expect(d.videoUrl).toBe("https://oss/old.mp4");
  });
});
