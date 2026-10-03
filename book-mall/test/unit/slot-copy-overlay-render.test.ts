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
    expect(svg).toContain('dominant-baseline="text-before-edge"');
    expect(svg).toContain('y="100"'); // textY = ny*1000 for ny=0.1 when no text bg
  });

  it("renders multiple lines with tspans", () => {
    const svg = buildSlotCopyOverlaySvg(750, 1000, [
      {
        id: "main",
        text: "国庆节，\n一双可以穿山越岭的户外鞋",
        nx: 0.08,
        ny: 0.12,
        fontSize: 43,
        color: "#2D1612",
        fontWeight: "bold",
        textAlign: "left",
        maxWidthNorm: 0.96,
      },
    ]);
    expect(svg).toContain("国庆节，");
    expect(svg).toContain("一双可以穿山越岭的户外鞋");
    expect(svg).toMatch(/<tspan[^>]*dy="0"/);
    expect(svg).toMatch(/<tspan[^>]*dy="[^"]+"/);
  });

  it("emits drop shadow filter when shadow enabled", () => {
    const svg = buildSlotCopyOverlaySvg(750, 1000, [
      {
        id: "main",
        text: "带投影",
        nx: 0.5,
        ny: 0.5,
        fontSize: 32,
        shadowBlur: 10,
        shadowColor: "#000000",
      },
    ]);
    expect(svg).toContain("feDropShadow");
    expect(svg).toContain('filter="url(#layer-fx-0)"');
  });

  it("omits shadow filter when shadowBlur is 0", () => {
    const svg = buildSlotCopyOverlaySvg(750, 1000, [
      {
        id: "main",
        text: "无投影",
        nx: 0.5,
        ny: 0.5,
        fontSize: 32,
        shadowBlur: 0,
      },
    ]);
    expect(svg).not.toContain("feDropShadow");
  });

  it("renders stroke and text background", () => {
    const svg = buildSlotCopyOverlaySvg(750, 1000, [
      {
        id: "main",
        text: "描边底",
        nx: 0.5,
        ny: 0.5,
        fontSize: 32,
        strokeWidth: 3,
        strokeColor: "#ff0000",
        textBgEnabled: true,
        textBgColor: "#000000",
        textBgOpacity: 0.4,
      },
    ]);
    expect(svg).toContain('stroke="#ff0000"');
    expect(svg).toContain('stroke-width="3"');
    expect(svg).toContain("<rect");
    expect(svg).toContain('fill-opacity="0.4"');
  });

  it("text background rect uses measured export box px", () => {
    const svg = buildSlotCopyOverlaySvg(750, 1000, [
      {
        id: "sub",
        text: "不惧风雨。",
        nx: 0.12,
        ny: 0.72,
        fontSize: 36,
        textAlign: "left",
        textBgEnabled: true,
        textBgPaddingPx: 10,
        layoutBoxWidthPx: 220,
        layoutBoxHeightPx: 68,
      },
    ]);
    expect(svg).toContain('width="220"');
    expect(svg).toContain('height="68"');
    expect(svg).toContain("不惧风雨。");
    expect(svg).toContain('dominant-baseline="central"');
  });
});
