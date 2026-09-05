import { describe, expect, it } from "vitest";

import { unifyKieChatMediaParts } from "@/lib/gateway/kie-chat-media";

describe("unifyKieChatMediaParts", () => {
  it("converts video_url parts to image_url for KIE unified media", () => {
    const out = unifyKieChatMediaParts([
      { type: "text", text: "describe" },
      {
        type: "video_url",
        video_url: { url: "https://example.com/a.mp4" },
      },
      {
        type: "image_url",
        image_url: { url: "https://example.com/b.png" },
      },
    ]);
    expect(out).toEqual([
      { type: "text", text: "describe" },
      {
        type: "image_url",
        image_url: { url: "https://example.com/a.mp4" },
      },
      {
        type: "image_url",
        image_url: { url: "https://example.com/b.png" },
      },
    ]);
  });
});
