import { describe, expect, it } from "vitest";

import {
  isJianyingMediaRenderDownloadExpired,
  resolveJianyingAutoRenderPlaybackUrl,
  normalizeJianyingAutoRenderNodeDataForPersist,
} from "@/lib/canvas/jianying-auto-render-playback-url";

describe("resolveJianyingAutoRenderPlaybackUrl", () => {
  const oss = "https://cdn.example.com/render/final.mp4";
  const local =
    "http://localhost:3000/api/book-mall/api/canvas/media/render/job-1/download";

  it("prefers OSS over persisted BFF local url", () => {
    expect(
      resolveJianyingAutoRenderPlaybackUrl({
        videoUrl: local,
        mediaRenderResult: {
          downloadUrl: oss,
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
          completedAt: new Date().toISOString(),
        },
      }),
    ).toBe(oss);
  });

  it("uses BFF local when OSS not ready yet", () => {
    expect(
      resolveJianyingAutoRenderPlaybackUrl({
        videoUrl: local,
        mediaRenderResult: null,
      }),
    ).toBe(local);
  });

  it("falls back to expired OSS when no local preview", () => {
    const expired = new Date(Date.now() - 1000).toISOString();
    expect(
      resolveJianyingAutoRenderPlaybackUrl({
        videoUrl: "",
        mediaRenderResult: {
          downloadUrl: oss,
          expiresAt: expired,
          completedAt: expired,
        },
      }),
    ).toBe(oss);
  });
});

describe("isJianyingMediaRenderDownloadExpired", () => {
  it("detects past expiresAt", () => {
    expect(
      isJianyingMediaRenderDownloadExpired(
        new Date(Date.now() - 60_000).toISOString(),
      ),
    ).toBe(true);
  });
});

describe("normalizeJianyingAutoRenderNodeDataForPersist", () => {
  it("replaces session local videoUrl with oss downloadUrl", () => {
    const oss = "https://cdn.example.com/x.mp4";
    const local = "/api/book-mall/api/canvas/media/render/j/download";
    const next = normalizeJianyingAutoRenderNodeDataForPersist({
      videoUrl: local,
      mediaRenderResult: {
        downloadUrl: oss,
        expiresAt: "2099-01-01T00:00:00.000Z",
        completedAt: "2026-01-01T00:00:00.000Z",
        posterUrl: "https://cdn.example.com/p.jpg",
      },
    });
    expect(next.videoUrl).toBe(oss);
    expect(next.posterUrl).toBe("https://cdn.example.com/p.jpg");
  });
});
