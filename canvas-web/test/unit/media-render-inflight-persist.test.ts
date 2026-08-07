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
});
