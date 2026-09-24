import { describe, expect, it } from "vitest";

import {
  imageLayerGenerationKindLabel,
  resolveImageLayerHistoryPreview,
} from "@/lib/image-layer-history";

describe("imageLayerGenerationKindLabel", () => {
  it("names each persisted history kind", () => {
    expect(imageLayerGenerationKindLabel("upload")).toBe("上传");
    expect(imageLayerGenerationKindLabel("bg-replace")).toBe("背景与主体");
    expect(imageLayerGenerationKindLabel("retouch")).toBe("局部重绘");
    expect(imageLayerGenerationKindLabel("decompose")).toBe("图层分离");
  });

  it("shows before/after, prompt and refs for a history row", () => {
    const preview = resolveImageLayerHistoryPreview({
      id: "g1",
      kind: "bg-replace",
      at: "2026-09-24T12:00:00.000Z",
      title: "背景与主体",
      prompt: "放到图2位置",
      ossUrl: "https://oss.example/after.png",
      compareFromUrl: "https://oss.example/before.png",
      refImages: [{ url: "https://oss.example/ref.png", label: "图2参考" }],
    });
    expect(preview.beforeUrl).toBe("https://oss.example/before.png");
    expect(preview.afterUrl).toBe("https://oss.example/after.png");
    expect(preview.prompt).toBe("放到图2位置");
    expect(preview.refs).toEqual([
      { url: "https://oss.example/ref.png", label: "图2参考" },
    ]);
  });
});
