import { describe, expect, it } from "vitest";

import {
  hasQrInputSummarySnap,
  previewImageUrlFromQrDraft,
  readQrDraftFromInputSummary,
} from "@/lib/quick-replica/qr-log-draft";
import type { QrWorkspaceDraft } from "@/lib/quick-replica/qr-types";

describe("qr-log-draft", () => {
  it("recognizes qrTextToVideo snapshots used by 文生视频", () => {
    const summary = {
      model: "happyhorse-1-1/reference-to-video",
      qrTextToVideo: {
        draft: {
          category: "video",
          kind: "text-to-video",
          title: "体育场直播",
          targetImageUrl: "",
          referenceVideoUrl: "",
          referenceAudioUrl: "",
          sceneImageUrls: ["https://example.com/a.png"],
          prompt: "p",
          modelKey: "happyhorse-1-1/reference-to-video",
        } satisfies QrWorkspaceDraft,
      },
    };
    expect(hasQrInputSummarySnap(summary)).toBe(true);
    const draft = readQrDraftFromInputSummary(summary);
    expect(draft?.title).toBe("体育场直播");
    expect(previewImageUrlFromQrDraft(draft)).toBe("https://example.com/a.png");
  });

  it("ignores logs without QR snap keys", () => {
    expect(hasQrInputSummarySnap({ model: "x", input: {} })).toBe(false);
  });
});
