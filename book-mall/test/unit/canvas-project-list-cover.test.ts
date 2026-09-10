import { describe, expect, it } from "vitest";

import {
  coverSummaryFromLatestTask,
  projectListCoverSummaryFields,
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

  it("prefers nodes video over stale meta listCover with old video URL", () => {
    const cover = resolveProjectListCoverForListRow({
      meta: {
        listCover: {
          thumbnailUrl: "https://cdn.example/stale-poster.jpg",
          coverMediaKind: "video",
          coverVideoUrl: "https://cdn.example/stale-final.mp4",
          coverPosterUrl: "https://cdn.example/stale-poster.jpg",
        },
      },
      nodes: [
        {
          type: "sbv1-video-engine",
          data: {
            runtime: {
              ossUrl: "https://cdn.example/fresh-final.mp4",
              posterUrl: "https://cdn.example/fresh-poster.jpg",
            },
          },
        },
      ],
    });
    expect(cover.coverVideoUrl).toBe("https://cdn.example/fresh-final.mp4");
    expect(cover.coverPosterUrl).toBe("https://cdn.example/fresh-poster.jpg");
    expect(cover.thumbnailUrl).toBe("https://cdn.example/fresh-poster.jpg");
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

  it("uses ephemeral runtime url for list display when oss is missing", () => {
    const cover = projectListCoverSummaryFields(
      {
        nodes: [
          {
            type: "ai-video-engine",
            data: {
              runtime: {
                ephemeralUrl: "https://cdn.example/ephemeral-final.mp4",
              },
            },
          },
        ],
      },
      { forDisplay: true },
    );
    expect(cover.coverMediaKind).toBe("video");
    expect(cover.coverVideoUrl).toBe("https://cdn.example/ephemeral-final.mp4");
  });

  it("falls back to latest succeeded task cover", () => {
    const cover = resolveProjectListCoverForListRow({
      meta: {},
      nodes: [],
      taskCover: coverSummaryFromLatestTask({
        ossUrl: "https://cdn.example/task-video.mp4",
        resultPayload: { posterUrl: "https://cdn.example/task-poster.jpg" },
      }),
    });
    expect(cover.coverVideoUrl).toBe("https://cdn.example/task-video.mp4");
    expect(cover.coverPosterUrl).toBe("https://cdn.example/task-poster.jpg");
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
