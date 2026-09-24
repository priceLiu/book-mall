import { describe, expect, it } from "vitest";
import {
  canvasOssUrlBelongsToProject,
  isCanvasThumbnailUrlForProject,
} from "@/lib/canvas/canvas-oss-url-project";

describe("canvas-oss-url-project", () => {
  const pid = "cmtwobco301qkjjd1um9eihmm";

  it("matches own node-image path", () => {
    const url = `https://tool-mall.oss-cn-guangzhou.aliyuncs.com/canvas/node-image/${pid}/abc.jpg`;
    expect(canvasOssUrlBelongsToProject(url, pid)).toBe(true);
  });

  it("rejects other project path", () => {
    const url =
      "https://tool-mall.oss-cn-guangzhou.aliyuncs.com/canvas/node-image/cmtx8mxka02mojjwkjpodtasr/x.jpg";
    expect(canvasOssUrlBelongsToProject(url, pid)).toBe(false);
  });

  it("isCanvasThumbnailUrlForProject", () => {
    const foreign =
      "https://x.com/canvas/node-image/cmtx8mxka02mojjwkjpodtasr/x.jpg";
    expect(isCanvasThumbnailUrlForProject(foreign, pid)).toBe(false);
  });
});
