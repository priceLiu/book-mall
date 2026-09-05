import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/canvas-api", () => ({
  syncMediaRenderAudio: vi.fn(),
}));

import { syncMediaRenderAudio } from "@/lib/canvas-api";
import { syncMediaRenderFrameAudios } from "@/lib/canvas/media-render-sync-audio";

describe("syncMediaRenderFrameAudios", () => {
  beforeEach(() => {
    vi.mocked(syncMediaRenderAudio).mockReset();
  });

  it("skips API when all frames already have https audioUrl", async () => {
    const frames = [
      {
        frameIndex: 1,
        dialogue: "a",
        audioSourceNodeId: "n1",
        audioUrl: "https://cdn/1.mp3",
      },
    ];
    const labels: string[] = [];
    const out = await syncMediaRenderFrameAudios({
      base: "http://localhost:3000",
      projectId: "p1",
      frames,
      onProgress: ({ label }) => labels.push(label),
    });
    expect(syncMediaRenderAudio).not.toHaveBeenCalled();
    expect(out[0]?.audioUrl).toBe("https://cdn/1.mp3");
    expect(labels).toContain("配音已就绪，提交剪辑…");
  });

  it("syncs each pending frame and merges audioUrl", async () => {
    vi.mocked(syncMediaRenderAudio)
      .mockResolvedValueOnce("https://cdn/a1.mp3")
      .mockResolvedValueOnce("https://cdn/a2.mp3");

    const frames = [
      {
        frameIndex: 1,
        dialogue: "a",
        audioSourceNodeId: "n1",
        audioUrl: null,
      },
      {
        frameIndex: 2,
        dialogue: "b",
        audioSourceNodeId: "n2",
        audioUrl: null,
      },
    ];
    const labels: string[] = [];
    const out = await syncMediaRenderFrameAudios({
      base: "http://localhost:3000",
      projectId: "p1",
      frames,
      onProgress: ({ label }) => labels.push(label),
    });
    expect(syncMediaRenderAudio).toHaveBeenCalledTimes(2);
    expect(out[0]?.audioUrl).toBe("https://cdn/a1.mp3");
    expect(out[1]?.audioUrl).toBe("https://cdn/a2.mp3");
    expect(labels.some((l) => l.includes("同步配音 1/2"))).toBe(true);
    expect(labels.some((l) => l.includes("同步配音 2/2 完成"))).toBe(true);
  });
});
