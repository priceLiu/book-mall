/* eslint-disable no-console */
/**
 * 把 story-web/src/shared/styles/index.json 同步到 book-mall/lib/story/styles.json。
 * 用途：保证 book-mall 后端在生成 prompt 时拼接的 [STYLE] 与 story-web 前端展示选项一致。
 *
 * 使用：
 *   pnpm story:sync-styles            # 写入并校验
 *   pnpm story:sync-styles --check    # 仅校验是否同步（CI 可用，不一致则非零退出）
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..", "..");
const SRC = resolve(ROOT, "story-web", "src", "shared", "styles", "index.json");
const DST = resolve(__dirname, "..", "lib", "story", "styles.json");

function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

function readBuf(path: string): Buffer {
  try {
    return readFileSync(path);
  } catch (e) {
    console.error(`[sync-story-styles] read failed: ${path}`);
    throw e;
  }
}

function main() {
  const checkOnly = process.argv.includes("--check");

  const srcBuf = readBuf(SRC);
  const srcHash = sha256(srcBuf);
  let dstHash: string | null;
  try {
    dstHash = sha256(readBuf(DST));
  } catch {
    dstHash = null;
  }

  if (srcHash === dstHash) {
    console.log(`[sync-story-styles] OK · sha256=${srcHash}`);
    return;
  }

  if (checkOnly) {
    console.error(
      `[sync-story-styles] DRIFT · src=${srcHash} dst=${dstHash ?? "(missing)"}`,
    );
    console.error("Run `pnpm story:sync-styles` to update.");
    process.exit(1);
  }

  // Validate JSON shape briefly before writing
  const parsed = JSON.parse(srcBuf.toString("utf8"));
  if (!Array.isArray(parsed) || parsed.length === 0) {
    console.error("[sync-story-styles] src is not a non-empty array; abort");
    process.exit(2);
  }

  writeFileSync(DST, srcBuf);
  console.log(
    `[sync-story-styles] wrote ${DST} (${parsed.length} styles, sha256=${srcHash})`,
  );
}

main();
