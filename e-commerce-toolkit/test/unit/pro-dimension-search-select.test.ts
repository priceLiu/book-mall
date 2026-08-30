import { describe, expect, it } from "vitest";

import { filterDimensionOptions } from "@/lib/pro-vertical/dimension-search";

describe("pro-dimension-search-select", () => {
  const options = ["手机", "耳机", "智能手表", "平板", "笔记本"];

  it("returns all options when query is empty", () => {
    expect(filterDimensionOptions(options, "")).toEqual(options);
  });

  it("filters options by includes match", () => {
    expect(filterDimensionOptions(options, "手")).toEqual(["手机", "智能手表"]);
    expect(filterDimensionOptions(options, "平板")).toEqual(["平板"]);
  });

  it("is case insensitive", () => {
    expect(filterDimensionOptions(["iPhone", "iPad"], "iphone")).toEqual(["iPhone"]);
  });
});
