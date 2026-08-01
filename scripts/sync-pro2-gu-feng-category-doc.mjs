#!/usr/bin/env node
/**
 * 将 docs/古风田宠短剧.md 同步到 canvas-web / book-mall 内嵌类别参考。
 * 界面预览与发送时的「剧本类别参考」读 PRO2_GU_FENG_CATEGORY_DOC_SOURCE_MD，不直接读 docs。
 *
 * 用法：node scripts/sync-pro2-gu-feng-category-doc.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceMd = path.join(root, "docs/古风田宠短剧.md");

if (!fs.existsSync(sourceMd)) {
  console.error("找不到源文件:", sourceMd);
  process.exit(1);
}

const body = fs.readFileSync(sourceMd, "utf8").trim();
const escaped = JSON.stringify(body);

const outRel = "lib/canvas/data/pro2-gu-feng-category-doc-source.ts";
const header = `/**
 * 古风甜宠短剧 · 类别参考真源（内嵌字符串）
 * 源文件：docs/古风田宠短剧.md
 * 生成：node scripts/sync-pro2-gu-feng-category-doc.mjs（改 docs 后须运行）
 */
export const PRO2_GU_FENG_CATEGORY_DOC_SOURCE_MD = ${escaped};
`;

for (const pkg of ["canvas-web", "book-mall"]) {
  const out = path.join(root, pkg, outRel);
  fs.writeFileSync(out, header, "utf8");
  console.log("wrote", path.relative(root, out), `(${body.length} chars)`);
}
