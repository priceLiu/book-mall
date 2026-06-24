import { describe, expect, it } from "vitest";

import {
  mergePersistedMediaIntoCanvasGraph,
  shouldPreserveExistingNodeMedia,
} from "@/lib/canvas/canvas-persist-merge";
import {
  buildMediaRuntimePatchFromTask,
  canvasNodeShowsPersistedMedia,
  patchCanvasJsonNodeMedia,
} from "@/lib/canvas/canvas-media-patch";
import { computeTaskPromptArchive } from "@/lib/canvas/canvas-task-prompt-archive";

describe("mergePersistedMediaIntoCanvasGraph · 防 autosave 覆盖成片", () => {
  const existing = {
    nodes: [
      {
        id: "vid1",
        type: "sbv1-video-engine",
        data: {
          runtime: {
            status: "done",
            taskId: "task-a",
            ossUrl: "https://cdn.example/saved.mp4",
          },
        },
      },
    ],
  };

  it("保留 DB 成片：客户端 PATCH 仍为 running 且无 URL", () => {
    const incoming = {
      nodes: [
        {
          id: "vid1",
          type: "sbv1-video-engine",
          data: { runtime: { status: "running", taskId: "task-a" } },
        },
      ],
    };
    const merged = mergePersistedMediaIntoCanvasGraph(incoming, existing) as typeof incoming;
    expect(merged.nodes[0]?.data?.runtime?.status).toBe("done");
    expect(merged.nodes[0]?.data?.runtime?.ossUrl).toBe(
      "https://cdn.example/saved.mp4",
    );
  });

  it("不覆盖用户已写回的新 done 成片", () => {
    const incoming = {
      nodes: [
        {
          id: "vid1",
          type: "sbv1-video-engine",
          data: {
            runtime: {
              status: "done",
              taskId: "task-b",
              ossUrl: "https://cdn.example/newer.mp4",
            },
          },
        },
      ],
    };
    const merged = mergePersistedMediaIntoCanvasGraph(incoming, existing) as typeof incoming;
    expect(merged.nodes[0]?.data?.runtime?.ossUrl).toBe(
      "https://cdn.example/newer.mp4",
    );
  });

  it("空画布 PATCH 仍被上层拒绝（merge 不制造节点）", () => {
    expect(mergePersistedMediaIntoCanvasGraph({ nodes: [] }, existing)).toEqual({
      nodes: [],
    });
  });
});

describe("shouldPreserveExistingNodeMedia", () => {
  it("existing done+url vs incoming running → preserve", () => {
    expect(
      shouldPreserveExistingNodeMedia(
        { status: "running", taskId: "t1" },
        { status: "done", url: "https://x", taskId: "t1" },
      ),
    ).toBe(true);
  });

  it("incoming done+url → no preserve", () => {
    expect(
      shouldPreserveExistingNodeMedia(
        { status: "done", url: "https://new", taskId: "t2" },
        { status: "done", url: "https://old", taskId: "t1" },
      ),
    ).toBe(false);
  });
});

describe("patchCanvasJsonNodeMedia · 任务写回可恢复", () => {
  it("写回后 canvas JSON 可检测到 persisted media", () => {
    const canvas = {
      nodes: [{ id: "img1", type: "sbv1-image", data: {} }],
    };
    const runtime = buildMediaRuntimePatchFromTask(
      {
        id: "t1",
        ossUrl: "https://cdn.example/a.png",
        ephemeralUrl: null,
        resultPayload: null,
      },
      "https://cdn.example/a.png",
    );
    const next = patchCanvasJsonNodeMedia(
      canvas,
      "img1",
      "sbv1-image",
      "https://cdn.example/a.png",
      runtime,
    );
    expect(canvasNodeShowsPersistedMedia(next, "img1", "t1")).toBe(true);
    const node = (next as typeof canvas).nodes[0];
    expect(node.data.ossUrl).toBe("https://cdn.example/a.png");
  });
});

describe("computeTaskPromptArchive · 归档不丢原始 payload", () => {
  it("从 inputPayload 提取归档，不改变源数据引用内容", () => {
    const payload = {
      kind: "ai-engine",
      prompt: "  主角走进雨夜  ",
      modelKey: "gpt-test",
    };
    const snapshot = structuredClone(payload);
    const archive = computeTaskPromptArchive({
      kind: "TEXT",
      inputPayload: payload,
    });
    expect(archive.archivePromptText).toBe("主角走进雨夜");
    expect(archive.archiveMediaKind).toBe("TEXT");
    expect(payload).toEqual(snapshot);
  });
});
