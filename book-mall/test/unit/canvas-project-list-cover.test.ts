import { describe, expect, it } from "vitest";

import {
  resolveProjectListCoverForListRow,
} from "@/lib/canvas/canvas-project-list-cover";

describe("resolveProjectListCoverForListRow", () => {
  it("uses meta.listCover when hover video is present", () => {
    const cover = resolveProjectListCoverForListRow({
      meta: {
        listCover: {
          thumbnailUrl: "https://cdn.example/poster.jpg",
          coverMediaKind: "video",
          coverVideoUrl: "https://cdn.example/final.mp4",
          coverPosterUrl: "https://cdn.example/poster.jpg",
        },
      },
    });
    expect(cover.coverMediaKind).toBe("video");
    expect(cover.coverVideoUrl).toBe("https://cdn.example/final.mp4");
  });

  it("falls back to nodes when meta has no listCover", () => {
    const cover = resolveProjectListCoverForListRow({
      meta: {},
      storedThumbnailUrl: "https://cdn.example/old-thumb.jpg",
      nodes: [
        {
          type: "sbv1-video-engine",
          data: {
            videoUrl: "https://cdn.example/node-video.mp4",
            runtime: { posterUrl: "https://cdn.example/node-poster.jpg" },
          },
        },
      ],
    });
    expect(cover.coverMediaKind).toBe("video");
    expect(cover.coverVideoUrl).toBe("https://cdn.example/node-video.mp4");
    expect(cover.coverPosterUrl).toBe("https://cdn.example/node-poster.jpg");
    expect(cover.thumbnailUrl).toBe("https://cdn.example/node-poster.jpg");
  });

  it("prefers nodes video over stale image-only meta listCover", () => {
    const cover = resolveProjectListCoverForListRow({
      meta: {
        listCover: {
          thumbnailUrl: "https://cdn.example/storyboard.jpg",
          coverMediaKind: "image",
        },
      },
      nodes: [
        {
          type: "story-pro-video",
          data: {
            videoUrl: "https://cdn.example/pro-video.mp4",
          },
        },
      ],
    });
    expect(cover.coverMediaKind).toBe("video");
    expect(cover.coverVideoUrl).toBe("https://cdn.example/pro-video.mp4");
  });

  it("treats stored thumbnail as video when URL looks like mp4", () => {
    const cover = resolveProjectListCoverForListRow({
      meta: {},
      storedThumbnailUrl: "https://cdn.example/legacy-final.mp4",
    });
    expect(cover.coverMediaKind).toBe("video");
    expect(cover.coverVideoUrl).toBe("https://cdn.example/legacy-final.mp4");
  });
});
