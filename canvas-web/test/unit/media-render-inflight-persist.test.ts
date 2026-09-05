import { describe, expect, it } from "vitest";
import {
  clearStaleMediaRenderInFlightInNodes,
  isStaleMediaRenderInFlight,
} from "@/lib/canvas/media-render-in-flight";
import { stripGraphForPersist } from "@/lib/canvas/sanitize";
import type { CanvasGraph } from "@/lib/canvas/types";

describe("mediaRenderInFlight persist", () => {
  it("treats pending jobId as stale", () => {
    expect(
      isStaleMediaRenderInFlight({
        jobId: "pending",
        status: "PENDING",
        progress: 0,
        progressLabel: "提交任务…",
      }),
    ).toBe(true);
    expect(
      isStaleMediaRenderInFlight({
        jobId: "job_abc",
        status: "RUNNING",
        progress: 40,
      }),
    ).toBe(false);
  });

  it("clears pending inFlight on hydrate", () => {
    const nodes = clearStaleMediaRenderInFlightInNodes([
      {
        data: {
          mediaRenderInFlight: {
            jobId: "pending",
            status: "PENDING",
            progress: 0,
            progressLabel: "提交任务…",
          },
        },
      },
      {
        data: {
          mediaRenderInFlight: {
            jobId: "job_keep",
            status: "RUNNING",
            progress: 20,
          },
        },
      },
    ]);
    expect(nodes[0]!.data!.mediaRenderInFlight).toBeNull();
    expect(
      (nodes[1]!.data!.mediaRenderInFlight as { jobId: string }).jobId,
    ).toBe("job_keep");
  });

  it("strips mediaRenderInFlight from persist graph", () => {
    const graph: CanvasGraph = {
      schemaVersion: 2,
      nodes: [
        {
          id: "n1",
          type: "jianying-auto-render-pro2",
          position: { x: 0, y: 0 },
          data: {
            mediaRenderInFlight: {
              jobId: "pending",
              status: "PENDING",
              progress: 0,
            },
            label: "自动成片",
          },
        },
      ],
      edges: [],
    };
    const stripped = stripGraphForPersist(graph);
    expect(stripped.nodes[0]!.data).not.toHaveProperty("mediaRenderInFlight");
    expect(stripped.nodes[0]!.data).toMatchObject({ label: "自动成片" });
  });

  it("persists bound image/video generating runtime for refresh restore", () => {
    const graph: CanvasGraph = {
      schemaVersion: 2,
      nodes: [
        {
          id: "img-1",
          type: "sbv1-image",
          position: { x: 0, y: 0 },
          data: {
            uploading: true,
            blobUrl: "blob:local",
            ossUrl: "https://cdn.example/old.png",
            runtime: {
              status: "pending",
              taskId: "task-img",
              ossUrl: "https://cdn.example/old.png",
              ephemeralUrl: "https://tmp/ephemeral.png",
            },
          },
        },
        {
          id: "vid-1",
          type: "sbv1-video-engine",
          position: { x: 0, y: 0 },
          data: {
            runtime: {
              status: "running",
              taskId: "task-vid",
              ossUrl: "https://cdn.example/old.mp4",
            },
          },
        },
        {
          id: "orphan",
          type: "story-pro2-image",
          position: { x: 0, y: 0 },
          data: {
            uploading: true,
            runtime: { status: "pending" },
          },
        },
      ],
      edges: [],
    };
    const stripped = stripGraphForPersist(graph);
    expect(stripped.nodes[0]!.data).toMatchObject({
      ossUrl: "https://cdn.example/old.png",
      runtime: {
        status: "pending",
        taskId: "task-img",
        ossUrl: "https://cdn.example/old.png",
      },
    });
    expect(stripped.nodes[0]!.data).not.toHaveProperty("uploading");
    expect(stripped.nodes[0]!.data).not.toHaveProperty("blobUrl");
    expect(
      (stripped.nodes[0]!.data as { runtime: { ephemeralUrl?: string } }).runtime,
    ).not.toHaveProperty("ephemeralUrl");
    expect(stripped.nodes[1]!.data).toMatchObject({
      runtime: { status: "running", taskId: "task-vid" },
    });
    expect(stripped.nodes[2]!.data).toMatchObject({
      runtime: { status: "idle" },
    });
    expect(
      (stripped.nodes[2]!.data as { runtime: { taskId?: string } }).runtime,
    ).not.toHaveProperty("taskId");
  });
});
