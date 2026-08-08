import { describe, expect, it } from "vitest";

import {
  isMediaRenderSessionLocalUrl,
  resolveMediaRenderLocalDownloadUrl,
} from "@/lib/canvas/media-render-session-url";

describe("media-render-session-url", () => {
  it("builds BFF local download url", () => {
    const url = resolveMediaRenderLocalDownloadUrl("http://localhost:3000", {
      id: "job1",
      localDownloadPath: "/api/canvas/media/render/job1/download",
    });
    expect(url).toContain("/api/canvas/media/render/job1/download");
  });

  it("detects session local preview url", () => {
    expect(
      isMediaRenderSessionLocalUrl(
        "http://localhost:3000/api/book-mall/api/canvas/media/render/abc/download",
        "abc",
      ),
    ).toBe(true);
    expect(
      isMediaRenderSessionLocalUrl(
        "https://tool-mall.oss-cn-guangzhou.aliyuncs.com/x.mp4",
        "abc",
      ),
    ).toBe(false);
  });
});
