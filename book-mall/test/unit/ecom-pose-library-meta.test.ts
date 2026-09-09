import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  filterPoseEntries,
  inferCategoryFromDescription,
  matchesPoseGenderFilter,
  parsePoseLibraryMarkdown,
} from "@/lib/ecom/ecom-pose-library-meta";
import type { EcomPoseLibraryEntry } from "@/lib/ecom/ecom-pose-library-service";

describe("ecom-pose-library-meta", () => {
  it("parses docs/姿势库md into 160 rows", () => {
    const md = readFileSync(resolve(__dirname, "../../../docs/姿势库md"), "utf8");
    const rows = parsePoseLibraryMarkdown(md);
    expect(rows).toHaveLength(160);
    expect(rows.filter((r) => r.id.startsWith("COMM-F-"))).toHaveLength(50);
    expect(rows.filter((r) => r.id.startsWith("COMM-M-"))).toHaveLength(50);
    expect(rows.filter((r) => r.id.startsWith("TRAV-F-"))).toHaveLength(30);
    expect(rows.filter((r) => r.id.startsWith("TRAV-M-"))).toHaveLength(30);
  });

  it("parses docs/姿势库 大动作.md into 60 dramatic rows", () => {
    const md = readFileSync(resolve(__dirname, "../../../docs/姿势库 大动作.md"), "utf8");
    const rows = parsePoseLibraryMarkdown(md);
    expect(rows).toHaveLength(60);
    expect(rows.filter((r) => r.id.startsWith("DRAM-F-"))).toHaveLength(30);
    expect(rows.filter((r) => r.id.startsWith("DRAM-M-"))).toHaveLength(30);
    expect(rows[0]?.sceneTags).toEqual(["夸张", "红毯", "戏剧"]);
    expect(rows[0]?.genders).toEqual(["female"]);
  });

  it("infers category from description", () => {
    expect(inferCategoryFromDescription("背对镜头站立，头部回眸")).toBe("E");
    expect(inferCategoryFromDescription("向前行走，右腿迈出")).toBe("B");
    expect(inferCategoryFromDescription("正面标准站姿，双脚与肩同宽")).toBe("A");
  });

  it("filters by gender and scene tags", () => {
    const entries: EcomPoseLibraryEntry[] = [
      {
        id: "a",
        category: "A",
        title: "女",
        baseDescription: "x",
        genders: ["female"],
        sceneTags: ["电商"],
      },
      {
        id: "b",
        category: "A",
        title: "男",
        baseDescription: "x",
        genders: ["male"],
        sceneTags: ["游玩"],
      },
      {
        id: "c",
        category: "A",
        title: "全",
        baseDescription: "x",
        genders: ["unisex"],
        sceneTags: ["电商", "游玩"],
      },
    ];
    expect(filterPoseEntries(entries, { genders: ["female"] }).map((e) => e.id)).toEqual([
      "a",
      "c",
    ]);
    expect(filterPoseEntries(entries, { sceneTags: ["游玩"] }).map((e) => e.id)).toEqual([
      "b",
      "c",
    ]);
    expect(
      filterPoseEntries(entries, { genders: ["male"], sceneTags: ["电商"] }).map((e) => e.id),
    ).toEqual(["c"]);
  });

  it("treats unisex as matching any gender filter", () => {
    expect(matchesPoseGenderFilter({ genders: ["unisex"] }, ["male"])).toBe(true);
    expect(matchesPoseGenderFilter({ genders: ["female"] }, ["male"])).toBe(false);
  });
});
