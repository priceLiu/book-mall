import { describe, expect, it } from "vitest";

import { listBuiltinQrTemplates } from "@/lib/quick-replica/builtin-templates";
import { getKindDef, getKindsForCategory } from "@/lib/quick-replica/qr-kinds";

describe("QrKindFeatured · kind 注册与内置回退", () => {
  it("video 分类包含 motion-sync 与 text-to-video", () => {
    const ids = getKindsForCategory("video").map((k) => k.id);
    expect(ids).toContain("motion-sync");
    expect(ids).toContain("text-to-video");
  });

  it("getKindDef 可解析跨分类 kind", () => {
    expect(getKindDef("motion-sync")?.toolKey).toBe("motion-sync");
    expect(getKindDef("create-image")?.label).toBe("创建图像");
  });

  it("motion-sync 存在内置种子模板供推荐回退", () => {
    const builtins = listBuiltinQrTemplates({ kind: "motion-sync" });
    expect(builtins.length).toBeGreaterThan(0);
    expect(builtins[0]?.source).toBe("builtin");
  });

  it("text-to-video 存在内置种子模板", () => {
    const builtins = listBuiltinQrTemplates({ kind: "text-to-video" });
    expect(builtins.length).toBeGreaterThan(0);
  });
});
