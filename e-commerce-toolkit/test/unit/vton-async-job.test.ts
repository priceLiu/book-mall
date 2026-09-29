import { describe, expect, it } from "vitest";

import { isVtonAsyncJobRunning, waitForVtonJobPoll } from "@/lib/vton-async-job";
import { parseVtonProjectMeta } from "@/lib/vton-types";

describe("vton async job persist/resume", () => {
  it("parses persisted textTryonJob and modelPipelineJob", () => {
    const meta = parseVtonProjectMeta({
      textTryonJob: {
        jobId: "t1",
        status: "running",
        startedAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        prompt: "试衣",
        modelKey: "wan2.7-image-pro",
      },
      modelPipelineJob: {
        jobId: "m1",
        status: "running",
        kind: "generating-model",
        startedAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      textTryonResults: [
        {
          id: "r1",
          ossUrl: "https://oss.example/a.jpg",
          prompt: "试衣",
          modelKey: "wan2.7-image-pro",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
    expect(meta.textTryonJob?.jobId).toBe("t1");
    expect(meta.modelPipelineJob?.kind).toBe("generating-model");
    expect(meta.textTryonResults?.[0]?.ossUrl).toContain("a.jpg");
    expect(isVtonAsyncJobRunning(meta.textTryonJob, Date.parse("2026-01-01T00:01:00.000Z"))).toBe(
      true,
    );
  });

  it("polls until the job is no longer running", async () => {
    let n = 0;
    const project = await waitForVtonJobPoll({
      fetchProject: async () => {
        n += 1;
        return { running: n < 3 };
      },
      isRunning: (p) => p.running,
      applyProject: () => undefined,
      intervalMs: 1,
    });
    expect(project.running).toBe(false);
    expect(n).toBeGreaterThanOrEqual(3);
  });
});
