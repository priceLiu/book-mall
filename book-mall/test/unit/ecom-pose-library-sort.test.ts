import { describe, expect, it } from "vitest";

import { sortPoseEntriesWithImageFirst } from "@/lib/ecom/ecom-pose-library-sort";

describe("sortPoseEntriesWithImageFirst", () => {
  it("ranks entries with ossUrl before text-only", () => {
    const sorted = sortPoseEntriesWithImageFirst([
      { id: "a", category: "A", title: "text", baseDescription: "x", sortOrder: 0 },
      {
        id: "b",
        category: "A",
        title: "img",
        baseDescription: "y",
        ossUrl: "https://cdn/b.webp",
        sortOrder: 1,
      },
    ]);
    expect(sorted.map((e) => e.id)).toEqual(["b", "a"]);
  });
});
