import { describe, expect, it } from "vitest";

import { mergeBuiltinWithOverride } from "@/lib/quick-replica/qr-builtin-catalog-merge";
import type { QrTemplateJson } from "@/lib/quick-replica/qr-types";

function builtinStadium(): QrTemplateJson {
  return {
    schemaVersion: 1,
    id: "qr-video-gallery-01",
    category: "video",
    kind: "text-to-video",
    title: "体育场直播",
    thumbnailUrl: "https://tool-mall.oss-cn-guangzhou.aliyuncs.com/quick-replica/builtin/qr-video-gallery-01.webp",
    source: "builtin",
    visibility: "public",
    reference: {
      slots: {},
      prompt: { text: "体育场直播", locale: "zh" },
      model: { role: "VIDEO", modelKey: "grok-imagine/image-to-video", params: {} },
    },
    output: {
      mediaType: "video",
      url: "https://tool-mall.oss-cn-guangzhou.aliyuncs.com/quick-replica/builtin/qr-video-gallery-01-video.mp4",
      createdAt: "2026-06-20T00:00:00.000Z",
    },
    sortOrder: 100,
    createdAt: "2026-06-20T00:00:00.000Z",
    updatedAt: "2026-06-20T00:00:00.000Z",
  };
}

describe("mergeBuiltinWithOverride", () => {
  it("keeps builtin output when override has no output url", () => {
    const builtin = builtinStadium();
    const override: QrTemplateJson = {
      ...builtin,
      id: "db-override",
      source: "catalog",
      title: "体育场直播（运营改标题）",
      output: undefined,
    };
    const merged = mergeBuiltinWithOverride(builtin, override);
    expect(merged.title).toBe("体育场直播（运营改标题）");
    expect(merged.output?.url).toContain("qr-video-gallery-01-video.mp4");
  });
});
