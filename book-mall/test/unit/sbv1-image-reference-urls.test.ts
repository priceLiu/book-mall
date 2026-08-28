import { describe, expect, it } from "vitest";

import { resolveSbv1ImageReferenceUrls } from "@/lib/canvas/sbv1-image-runner";

const NODE_OUTPUT =
  "https://tool-mall.oss-cn-guangzhou.aliyuncs.com/canvas/node-image/proj/out.png";
const UPLOAD_A =
  "https://tool-mall.oss-cn-guangzhou.aliyuncs.com/canvas/user-upload/user/a.jpg";
const UPLOAD_B =
  "https://tool-mall.oss-cn-guangzhou.aliyuncs.com/canvas/user-upload/user/b.jpg";

describe("resolveSbv1ImageReferenceUrls", () => {
  it("regenerate with dock refs excludes node previous output", () => {
    expect(
      resolveSbv1ImageReferenceUrls({
        isHdGridSplit: false,
        pendingGridCrop: false,
        precroppedUrl: "",
        selfUrl: NODE_OUTPUT,
        upstreamUrls: [UPLOAD_A, UPLOAD_B],
      }),
    ).toEqual([UPLOAD_A, UPLOAD_B]);
  });

  it("img2img-only re-run uses node output when no explicit refs", () => {
    expect(
      resolveSbv1ImageReferenceUrls({
        isHdGridSplit: false,
        pendingGridCrop: false,
        precroppedUrl: "",
        selfUrl: NODE_OUTPUT,
        upstreamUrls: [],
      }),
    ).toEqual([NODE_OUTPUT]);
  });
});
