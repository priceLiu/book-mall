import { describe, expect, it } from "vitest";

import { libtvImageNodeDisplayLabel } from "@/lib/canvas/libtv-image-node-title";

describe("libtvImageNodeDisplayLabel", () => {
  it("uses indexed default for generic placeholders", () => {
    expect(libtvImageNodeDisplayLabel("图片", "图片 3")).toBe("图片 3");
    expect(libtvImageNodeDisplayLabel("", "图片 1")).toBe("图片 1");
  });

  it("keeps frame extract titles", () => {
    expect(libtvImageNodeDisplayLabel("首帧", "图片 2")).toBe("首帧");
    expect(libtvImageNodeDisplayLabel("自定义帧", "图片 1")).toBe("自定义帧");
  });

  it("keeps user custom titles", () => {
    expect(libtvImageNodeDisplayLabel("主视觉", "图片 1")).toBe("主视觉");
  });
});
