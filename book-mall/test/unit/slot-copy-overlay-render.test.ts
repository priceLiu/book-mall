import { describe, expect, it } from "vitest";

import { buildSlotCopyOverlaySvg } from "@/lib/ecom/detail-page-suite/slot-copy-overlay-render";

describe("buildSlotCopyOverlaySvg", () => {
  it("includes text layer content", () => {
    const svg = buildSlotCopyOverlaySvg(750, 1000, [
      {
        id: "main",
        text: "测试标题",
        nx: 0.5,
        ny: 0.1,
        fontSize: 36,
        color: "#ffffff",
        fontWeight: "bold",
        textAlign: "center",
      },
    ]);
    expect(svg).toContain("测试标题");
    expect(svg).toContain('width="750"');
    expect(svg).toContain('height="1000"');
    expect(svg).toContain('dominant-baseline="hanging"');
    expect(svg).toContain('y="100"');
  });
});
