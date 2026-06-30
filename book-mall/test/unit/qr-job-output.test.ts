import { describe, expect, it } from "vitest";

import { extractQrJobOutputUrl } from "@/lib/quick-replica/qr-job-output";

describe("extractQrJobOutputUrl", () => {
  it("reads video_url from flat summary", () => {
    expect(
      extractQrJobOutputUrl({ video_url: "https://cdn.example.com/out.mp4" }),
    ).toEqual({ url: "https://cdn.example.com/out.mp4", mediaType: "video" });
  });

  it("reads url from KIE resultJson", () => {
    expect(
      extractQrJobOutputUrl({
        state: "success",
        resultJson: JSON.stringify({
          resultUrls: ["https://cdn.example.com/motion.mp4"],
        }),
      }),
    ).toEqual({ url: "https://cdn.example.com/motion.mp4", mediaType: "video" });
  });
});
