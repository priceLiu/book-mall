import { describe, expect, it } from "vitest";

import {
  isImageLayerDecomposeJobAlive,
  mergeImageLayerWorkspaceDuringDecompose,
  parseImageLayerDecomposeJob,
} from "@/lib/ecom/ecom-image-layer-decompose-job-state";
import type { ImageLayerWorkspace } from "@/lib/ecom/ecom-image-layer-project-types";

const stack = {
  background: {
    id: "bg",
    url: "https://oss.example/bg.jpg",
    zIndex: 0,
    isBackground: true,
  },
  layers: [],
};

describe("parseImageLayerDecomposeJob", () => {
  it("reads a running job", () => {
    const job = parseImageLayerDecomposeJob({
      decomposeJob: {
        id: "job-1",
        status: "running",
        startedAt: "2026-10-28T00:00:00.000Z",
        heartbeatAt: "2026-10-28T00:00:20.000Z",
      },
    });
    expect(job?.id).toBe("job-1");
    expect(job?.status).toBe("running");
  });

  it("returns null for a missing job", () => {
    expect(parseImageLayerDecomposeJob({})).toBeNull();
    expect(parseImageLayerDecomposeJob(null)).toBeNull();
  });
});

describe("isImageLayerDecomposeJobAlive", () => {
  const job = {
    id: "job-1",
    status: "running" as const,
    startedAt: "2026-10-28T00:00:00.000Z",
    heartbeatAt: "2026-10-28T00:00:20.000Z",
  };

  it("is alive within the heartbeat window", () => {
    const now = Date.parse(job.heartbeatAt) + 30_000;
    expect(isImageLayerDecomposeJobAlive(job, now)).toBe(true);
  });

  it("is dead after the heartbeat window", () => {
    const now = Date.parse(job.heartbeatAt) + 120_000;
    expect(isImageLayerDecomposeJobAlive(job, now)).toBe(false);
  });
});

describe("mergeImageLayerWorkspaceDuringDecompose", () => {
  const prev: ImageLayerWorkspace = {
    sourceImageUrl: "https://oss.example/src.jpg",
    stack,
  };

  it("keeps the existing stack while a live job is running and the client clears it", () => {
    const now = Date.parse("2026-10-28T00:00:20.000Z") + 1_000;
    const merged = mergeImageLayerWorkspaceDuringDecompose(
      prev,
      { sourceImageUrl: "https://oss.example/src.jpg", stack: null },
      {
        decomposeJob: {
          id: "job-1",
          status: "running",
          startedAt: "2026-10-28T00:00:00.000Z",
          heartbeatAt: "2026-10-28T00:00:20.000Z",
        },
      },
      now,
    );
    expect(merged.stack?.background.url).toBe("https://oss.example/bg.jpg");
  });

  it("accepts a cleared stack after the job is no longer running", () => {
    const merged = mergeImageLayerWorkspaceDuringDecompose(
      prev,
      { stack: null },
      {
        decomposeJob: {
          id: "job-1",
          status: "succeeded",
          startedAt: "2026-10-28T00:00:00.000Z",
          heartbeatAt: "2026-10-28T00:00:20.000Z",
          finishedAt: "2026-10-28T00:01:00.000Z",
        },
      },
    );
    expect(merged.stack).toBeNull();
  });
});
