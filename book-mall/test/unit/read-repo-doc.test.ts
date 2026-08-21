import { describe, expect, it } from "vitest";

import {
  extractDocSummary,
  isAllowedRepoDocPath,
  isAllowedRepoDocAssetPath,
  resolveRepoDocAssetPath,
  titleFromDocPath,
} from "@/lib/admin/read-repo-doc";

describe("titleFromDocPath", () => {
  it("uses basename without .md", () => {
    expect(titleFromDocPath("docs/一键发布平台.md")).toBe("一键发布平台");
    expect(titleFromDocPath("docs/sub/自动剪辑.md")).toBe("自动剪辑");
  });
});

describe("extractDocSummary", () => {
  it("skips headings and returns first paragraph line", () => {
    const md = `# 标题\n\n这是一段说明文字。\n\n正文继续。`;
    expect(extractDocSummary(md)).toBe("这是一段说明文字。");
  });
});

describe("isAllowedRepoDocPath", () => {
  it("allows docs/ and book-mall/doc/ prefixes", () => {
    expect(isAllowedRepoDocPath("docs/一键发布平台.md")).toBe(true);
    expect(isAllowedRepoDocPath("book-mall/doc/README.md")).toBe(true);
  });

  it("rejects traversal and other prefixes", () => {
    expect(isAllowedRepoDocPath("../etc/passwd")).toBe(false);
    expect(isAllowedRepoDocPath("canvas-web/docs/x.md")).toBe(false);
    expect(isAllowedRepoDocPath("")).toBe(false);
  });
});

describe("isAllowedRepoDocAssetPath", () => {
  it("allows image assets under docs/", () => {
    expect(isAllowedRepoDocAssetPath("docs/site-architecture-diagram.png")).toBe(true);
    expect(isAllowedRepoDocAssetPath("docs/全站架构图.svg")).toBe(true);
  });

  it("rejects non-image and traversal", () => {
    expect(isAllowedRepoDocAssetPath("docs/全站架构图.mmd")).toBe(false);
    expect(isAllowedRepoDocAssetPath("../docs/x.png")).toBe(false);
  });
});

describe("resolveRepoDocAssetPath", () => {
  it("resolves relative img src from doc directory", () => {
    expect(
      resolveRepoDocAssetPath(
        "docs/全站架构图与配置表.md",
        "./site-architecture-diagram.png",
      ),
    ).toBe("docs/site-architecture-diagram.png");
  });

  it("ignores absolute and remote urls", () => {
    expect(resolveRepoDocAssetPath("docs/a.md", "https://example.com/x.png")).toBe(null);
    expect(resolveRepoDocAssetPath("docs/a.md", "/static/x.png")).toBe(null);
  });
});
