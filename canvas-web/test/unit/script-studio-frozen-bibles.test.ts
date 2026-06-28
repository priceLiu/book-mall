import { describe, expect, it } from "vitest";
import { extractScriptStudioFrozenBiblesMd } from "@/lib/canvas/script-studio-frozen-bibles";

describe("extractScriptStudioFrozenBiblesMd", () => {
  it("extracts prefix before first episode heading", () => {
    const md = `# 文件1：世界观圣经
宇宙设定…

# 文件2：人物关系网
角色 A…

# 第 1 集
第一场…`;
    const out = extractScriptStudioFrozenBiblesMd(md);
    expect(out).toContain("世界观圣经");
    expect(out).toContain("人物关系网");
    expect(out).not.toContain("第 1 集");
  });

  it("returns empty for batch-only markdown", () => {
    expect(extractScriptStudioFrozenBiblesMd("# 第 1 集\n场1")).toBe("");
  });
});
