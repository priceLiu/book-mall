import { describe, expect, it } from "vitest";

import { DEFAULT_OUTDOOR_SIZE_CHART_TABLE } from "@/lib/ecom/detail-page-suite/size-chart-defaults";
import {
  buildSizeChartSvg,
  renderSizeChartPng,
} from "@/lib/ecom/detail-page-suite/size-chart-render";

describe("detail-page-suite size chart render", () => {
  it("buildSizeChartSvg includes headers and first row", () => {
    const svg = buildSizeChartSvg(DEFAULT_OUTDOOR_SIZE_CHART_TABLE);
    expect(svg).toContain("女款外套尺码");
    expect(svg).toContain("后中长");
    expect(svg).toContain("155/80A");
  });

  it("renderSizeChartPng returns png buffer", async () => {
    const buf = await renderSizeChartPng(DEFAULT_OUTDOOR_SIZE_CHART_TABLE);
    expect(buf.length).toBeGreaterThan(500);
    expect(buf[0]).toBe(0x89);
  });
});
