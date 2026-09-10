import { describe, expect, it } from "vitest";

import { filterAvailableGarmentPool } from "@/lib/vton-garment-pool";
import { garmentPreviewThumbUrls } from "@/lib/vton-full-set-garment";
import type { VtonGarmentItem, VtonLookSpec } from "@/lib/vton-types";

describe("filterAvailableGarmentPool", () => {
  const fullSetId = "set-1";
  const pool: VtonGarmentItem[] = [
    {
      id: fullSetId,
      kind: "full_set",
      ossUrl: "https://x/original.jpg",
      parsedTopUrl: "https://x/top.jpg",
      fullSetInputMode: "manual",
    },
  ];
  const looks: VtonLookSpec[] = [
    { id: "look-1", kind: "full_set", fullSetGarmentId: fullSetId },
  ];

  it("keeps incomplete manual full_set in pool even when assigned to a look", () => {
    expect(filterAvailableGarmentPool(pool, looks)).toHaveLength(1);
  });

  it("hides complete manual full_set from pool once assigned to a look", () => {
    const complete = [
      {
        ...pool[0]!,
        parsedBottomUrl: "https://x/bottom.jpg",
      },
    ];
    expect(filterAvailableGarmentPool(complete, looks)).toHaveLength(0);
  });

  it("keeps composite full_set visible in pool when used in a look", () => {
    const compositePool: VtonGarmentItem[] = [
      {
        id: "set-composite",
        kind: "full_set",
        ossUrl: "https://x/original.jpg",
        parsedTopUrl: "https://x/top.jpg",
        parsedBottomUrl: "https://x/bottom.jpg",
        fullSetInputMode: "composite",
      },
    ];
    const compositeLooks: VtonLookSpec[] = [
      { id: "look-1", kind: "full_set", fullSetGarmentId: "set-composite" },
    ];
    expect(filterAvailableGarmentPool(compositePool, compositeLooks)).toHaveLength(1);
  });
});

describe("garmentPreviewThumbUrls", () => {
  it("prefers parsed top/bottom for full_set", () => {
    expect(
      garmentPreviewThumbUrls({
        id: "1",
        kind: "full_set",
        ossUrl: "https://x/original.jpg",
        parsedTopUrl: "https://x/top.jpg",
        parsedBottomUrl: "https://x/bottom.jpg",
      }),
    ).toEqual(["https://x/top.jpg", "https://x/bottom.jpg"]);
  });
});
