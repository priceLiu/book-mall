import { describe, expect, it } from "vitest";

import {
  DIMENSION_SEARCH_DEFAULT_VISIBLE,
  dimensionOptionsHasMore,
  filterDimensionOptions,
} from "@/lib/pro-vertical/dimension-search";

describe("pro-dimension-search-select", () => {
  const options = ["手机", "耳机", "智能手表", "平板", "笔记本", "充电器", "移动电源"];

  it("returns first 5 options when query is empty", () => {
    expect(filterDimensionOptions(options, "")).toEqual(options.slice(0, 5));
    expect(dimensionOptionsHasMore(options, "")).toBe(true);
  });

  it("returns all options when count is within default limit", () => {
    const small = options.slice(0, 3);
    expect(filterDimensionOptions(small, "")).toEqual(small);
    expect(dimensionOptionsHasMore(small, "")).toBe(false);
  });

  it("filters all matching options when query is non-empty", () => {
    expect(filterDimensionOptions(options, "手")).toEqual(["手机", "智能手表"]);
    expect(filterDimensionOptions(options, "平板")).toEqual(["平板"]);
    expect(dimensionOptionsHasMore(options, "手")).toBe(false);
  });

  it("is case insensitive", () => {
    expect(filterDimensionOptions(["iPhone", "iPad"], "iphone")).toEqual(["iPhone"]);
  });

  it("respects custom default visible count", () => {
    expect(filterDimensionOptions(options, "", 3)).toEqual(options.slice(0, 3));
  });

  it("exports default visible constant as 5", () => {
    expect(DIMENSION_SEARCH_DEFAULT_VISIBLE).toBe(5);
  });
});
