import { describe, expect, it } from "vitest";

import { userFacingVideoTrackSplitError } from "@/lib/canvas-video-edit/canvas-video-track-split";

describe("userFacingVideoTrackSplitError", () => {
  it("keeps business errors", () => {
    expect(userFacingVideoTrackSplitError("成片没有音轨，已是无声视频")).toBe(
      "成片没有音轨，已是无声视频",
    );
  });

  it("hides OSS TLS handshake dump", () => {
    expect(
      userFacingVideoTrackSplitError(
        "Client network socket disconnected before secure TLS connection was established, GET https://tool-mall.oss-cn-guangzhou.aliyuncs.com/canvas/node-video/x.mp4",
      ),
    ).toBe("成片读取或写入云存储失败，请稍后重试");
  });
});
