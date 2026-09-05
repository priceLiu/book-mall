import { describe, expect, it } from "vitest";

import {
  buildFashionDimensionMessageLabels,
  buildFashionDimensionsFromChat,
} from "@/lib/fashion-dimensions";

describe("fashion dimension message labels", () => {
  it("labels each step and continues after revise message", () => {
    const messages = [
      { id: "u1", role: "user", content: "裙装" },
      { id: "u2", role: "user", content: "修改七维·性别品类" },
      { id: "u3", role: "user", content: "裙装" },
      { id: "u4", role: "user", content: "连衣裙" },
    ];
    const labels = buildFashionDimensionMessageLabels(messages);
    expect(labels.get("u1")).toMatchObject({ label: "性别品类", progress: "1/7" });
    expect(labels.has("u2")).toBe(false);
    expect(labels.get("u3")).toMatchObject({ label: "性别品类", progress: "1/7" });
    expect(labels.get("u4")).toMatchObject({ label: "款式品类", progress: "2/7" });
  });

  it("replays dimensions after revise", () => {
    const messages = [
      { role: "user", content: "裙装" },
      { role: "user", content: "连衣裙" },
      { role: "user", content: "修改七维·性别品类" },
      { role: "user", content: "女装" },
    ];
    const dims = buildFashionDimensionsFromChat(messages);
    expect(dims.genderCategory).toBe("女装");
    expect(dims.styleCategory).toBeUndefined();
  });
});
