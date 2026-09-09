import { describe, expect, it } from "vitest";

import {
  applyFullSetGarmentUpload,
  isFullSetGarmentReady,
} from "@/lib/ecom/ecom-vton/full-set-garment-upload";
import { emptyVtonProjectMeta } from "@/lib/ecom/ecom-vton/meta";

describe("applyFullSetGarmentUpload", () => {
  it("adds composite full_set row", () => {
    const meta = applyFullSetGarmentUpload({
      meta: emptyVtonProjectMeta(),
      kind: "full_set",
      ossUrl: "https://example.com/set.jpg",
      label: "套装 A",
      source: "upload",
      fullSetSlot: "composite",
    });
    expect(meta.garmentPool).toHaveLength(1);
    expect(meta.garmentPool![0]).toMatchObject({
      kind: "full_set",
      ossUrl: "https://example.com/set.jpg",
      label: "套装 A",
      fullSetInputMode: "composite",
    });
  });

  it("creates partial full_set with top slot", () => {
    const meta = applyFullSetGarmentUpload({
      meta: emptyVtonProjectMeta(),
      kind: "full_set",
      ossUrl: "https://example.com/top.jpg",
      label: "上装",
      source: "upload",
      fullSetSlot: "top",
    });
    const row = meta.garmentPool![0]!;
    expect(row.parsedTopUrl).toBe("https://example.com/top.jpg");
    expect(row.parsedBottomUrl).toBeUndefined();
    expect(row.fullSetInputMode).toBe("manual");
    expect(isFullSetGarmentReady(row)).toBe(false);
  });

  it("creates partial full_set with bottom slot", () => {
    const meta = applyFullSetGarmentUpload({
      meta: emptyVtonProjectMeta(),
      kind: "full_set",
      ossUrl: "https://example.com/bottom.jpg",
      label: "下装",
      source: "upload",
      fullSetSlot: "bottom",
    });
    const row = meta.garmentPool![0]!;
    expect(row.parsedBottomUrl).toBe("https://example.com/bottom.jpg");
    expect(row.parsedTopUrl).toBeUndefined();
    expect(row.fullSetInputMode).toBe("manual");
  });

  it("updates bottom slot on existing full_set", () => {
    let meta = applyFullSetGarmentUpload({
      meta: emptyVtonProjectMeta(),
      kind: "full_set",
      ossUrl: "https://example.com/top.jpg",
      label: "套装",
      source: "upload",
      fullSetSlot: "top",
    });
    const id = meta.garmentPool![0]!.id;
    meta = applyFullSetGarmentUpload({
      meta,
      kind: "full_set",
      ossUrl: "https://example.com/bottom.jpg",
      label: "下装",
      source: "upload",
      fullSetSlot: "bottom",
      garmentId: id,
    });
    const row = meta.garmentPool![0]!;
    expect(row.parsedTopUrl).toBe("https://example.com/top.jpg");
    expect(row.parsedBottomUrl).toBe("https://example.com/bottom.jpg");
    expect(isFullSetGarmentReady(row)).toBe(true);
  });

  it("replaces composite image on existing garment", () => {
    let meta = applyFullSetGarmentUpload({
      meta: emptyVtonProjectMeta(),
      kind: "full_set",
      ossUrl: "https://example.com/old-set.jpg",
      label: "套装",
      source: "upload",
      fullSetSlot: "composite",
    });
    const id = meta.garmentPool![0]!.id;
    meta = applyFullSetGarmentUpload({
      meta: {
        ...meta,
        garmentPool: [
          {
            ...meta.garmentPool![0]!,
            parsedTopUrl: "https://example.com/old-top.jpg",
            parsedBottomUrl: "https://example.com/old-bottom.jpg",
          },
        ],
      },
      kind: "full_set",
      ossUrl: "https://example.com/new-set.jpg",
      label: "新套装",
      source: "upload",
      fullSetSlot: "composite",
      garmentId: id,
    });
    expect(meta.garmentPool![0]).toMatchObject({
      id,
      ossUrl: "https://example.com/new-set.jpg",
      label: "新套装",
      parsedTopUrl: undefined,
      parsedBottomUrl: undefined,
    });
  });
});
