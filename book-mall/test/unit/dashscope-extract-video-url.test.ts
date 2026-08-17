import { describe, expect, it } from "vitest";

import { dashscopeExtractTaskVideoUrl } from "@/lib/gateway/dashscope-client";

describe("dashscopeExtractTaskVideoUrl", () => {
  it("reads flat output.video_url", () => {
    expect(
      dashscopeExtractTaskVideoUrl({
        task_status: "SUCCEEDED",
        video_url: "https://cdn.example/flat.mp4",
      }),
    ).toBe("https://cdn.example/flat.mp4");
  });

  it("reads wan2.2-s2v nested output.results.video_url", () => {
    expect(
      dashscopeExtractTaskVideoUrl({
        task_status: "SUCCEEDED",
        results: {
          video_url:
            "http://dashscope-result-bj.oss-cn-beijing.aliyuncs.com/out.mp4?Expires=123",
        },
      }),
    ).toBe(
      "https://dashscope-result-bj.oss-cn-beijing.aliyuncs.com/out.mp4?Expires=123",
    );
  });
});
