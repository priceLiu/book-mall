import { describe, expect, it } from "vitest";

import { qrTemplateNeedsVideoOutputHydration } from "@/lib/quick-replica/qr-template-output-enrich";
import type { QrTemplateJson } from "@/lib/quick-replica/qr-types";

function videoWork(partial: Partial<QrTemplateJson>): QrTemplateJson {
  return {
    schemaVersion: 1,
    id: "tpl-1",
    category: "video",
    kind: "motion-sync",
    toolKey: "motion-sync",
    title: "舞",
    thumbnailUrl: "https://example.com/person.jpg",
    source: "user",
    visibility: "private",
    reference: {
      slots: {
        referenceVideo: { url: "https://example.com/ref-dance.mp4" },
        targetImage: { url: "https://example.com/person.jpg" },
      },
      prompt: { text: "p", locale: "zh" },
      model: { role: "VIDEO", modelKey: "kling", params: {} },
    },
    sortOrder: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

describe("qrTemplateNeedsVideoOutputHydration", () => {
  it("needs hydrate when output url equals reference video", () => {
    const t = videoWork({
      output: {
        mediaType: "video",
        url: "https://example.com/ref-dance.mp4",
        gatewayRequestLogId: "log-1",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    });
    expect(qrTemplateNeedsVideoOutputHydration(t)).toBe(true);
  });

  it("needs hydrate when output is thumbnail image with log id", () => {
    const t = videoWork({
      output: {
        mediaType: "image",
        url: "https://example.com/person.jpg",
        gatewayRequestLogId: "log-1",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    });
    expect(qrTemplateNeedsVideoOutputHydration(t)).toBe(true);
  });

  it("skips when output is distinct generated mp4", () => {
    const t = videoWork({
      output: {
        mediaType: "video",
        url: "https://example.com/generated.mp4",
        gatewayRequestLogId: "log-1",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    });
    expect(qrTemplateNeedsVideoOutputHydration(t)).toBe(false);
  });
});
