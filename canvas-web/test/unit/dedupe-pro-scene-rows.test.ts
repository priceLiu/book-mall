import { describe, expect, it } from "vitest";
import { dedupeProSceneRows } from "@/lib/canvas/story-pro-column-sync";

describe("dedupeProSceneRows", () => {
  it("merges same scene name with different keys under one hub id", () => {
    const rows = dedupeProSceneRows(
      [
        { key: "s1", name: "校门口", description: "外景", prompt: "" },
        { key: "hub-a::校门口", name: "校门口", description: "", prompt: "详细" },
      ],
      "hub-a",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBe("校门口");
    expect(rows[0]?.prompt).toBe("详细");
  });
});
