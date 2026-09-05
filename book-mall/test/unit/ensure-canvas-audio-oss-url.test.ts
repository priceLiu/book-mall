import { describe, expect, it } from "vitest";

import {
  pickDataUrlFromNodeData,
  pickHttpsUrl,
} from "@/lib/canvas/ensure-canvas-audio-oss-url";

describe("ensure-canvas-audio-oss-url helpers", () => {
  it("pickHttpsUrl prefers first https candidate", () => {
    expect(
      pickHttpsUrl(undefined, "data:audio/mp3;base64,abc", "https://cdn/a.mp3"),
    ).toBe("https://cdn/a.mp3");
  });

  it("pickDataUrlFromNodeData reads runtime.ephemeralUrl and blobUrl", () => {
    const dataUrl = "data:audio/mpeg;base64,QQ==";
    expect(
      pickDataUrlFromNodeData({
        runtime: { ephemeralUrl: dataUrl },
        blobUrl: "blob:http://localhost/x",
      }),
    ).toBe(dataUrl);
    expect(
      pickDataUrlFromNodeData({
        blobUrl: dataUrl,
      }),
    ).toBe(dataUrl);
  });

  it("pickDataUrlFromNodeData ignores non-data urls", () => {
    expect(
      pickDataUrlFromNodeData({
        ossUrl: "https://cdn/a.mp3",
        blobUrl: "blob:http://localhost/x",
      }),
    ).toBe("");
  });
});
