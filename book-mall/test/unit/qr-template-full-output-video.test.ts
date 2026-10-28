import { describe, expect, it } from "vitest";

import { resolveQrTemplateFullOutputVideoUrl } from "../../../quick-replica-web/lib/qr-template-preview-media";

describe("resolveQrTemplateFullOutputVideoUrl", () => {
  it("prefers extensionless output over referenceVideo for video works", () => {
    const generated =
      "https://tool-mall.oss-cn-guangzhou.aliyuncs.com/canvas/user/u1/generated-motion";
    const reference = "https://tool-mall.oss-cn-guangzhou.aliyuncs.com/ref/dance.mp4";

    expect(
      resolveQrTemplateFullOutputVideoUrl({
        category: "video",
        output: {
          mediaType: "image",
          url: generated,
          gatewayRequestLogId: "log-1",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
        reference: {
          slots: { referenceVideo: { url: reference } },
          model: { role: "VIDEO", modelKey: "motion", params: {} },
        },
      }),
    ).toBe(generated);
  });

  it("does not use reference when output is explicit video", () => {
    const generated = "https://cdn.example.com/out.mp4";
    const reference = "https://cdn.example.com/ref.mp4";

    expect(
      resolveQrTemplateFullOutputVideoUrl({
        output: { mediaType: "video", url: generated, createdAt: "" },
        reference: { slots: { referenceVideo: { url: reference } } },
      }),
    ).toBe(generated);
  });
});
