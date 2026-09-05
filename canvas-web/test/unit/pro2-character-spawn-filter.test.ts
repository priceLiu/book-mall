import { describe, expect, it } from "vitest";
import { filterPro2RowsForSpawn } from "@/lib/canvas/pro2-media-row-spawn";
import type { StoryProCharacterRow } from "@/lib/canvas/story-pro-workspace-types";

describe("filterPro2RowsForSpawn", () => {
  const rows: StoryProCharacterRow[] = [
    {
      key: "a",
      name: "甲",
      role: "主角",
      appearance: "红袍",
      prompt: "",
    },
    {
      key: "b",
      name: "乙",
      role: "配角",
      appearance: "蓝衣",
      prompt: "",
    },
  ];

  it("returns all rows when rowKeys omitted", () => {
    expect(filterPro2RowsForSpawn(rows)).toHaveLength(2);
  });

  it("filters to selected rowKeys only", () => {
    expect(filterPro2RowsForSpawn(rows, ["b"]).map((r) => r.key)).toEqual([
      "b",
    ]);
  });
});
