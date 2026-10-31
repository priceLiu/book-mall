#!/usr/bin/env node
/**
 * CloudBase / Docker：file: 依赖经 pnpm 写入虚拟 store 时可能漏掉未列入 files 的 .ts。
 * 安装后从 /shared/platform-assistant（docker-shared 快照）覆盖同步到 store。
 */
import { cpSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const src = process.env.PLATFORM_ASSISTANT_SRC || "/shared/platform-assistant";
const pnpmDir = join(process.cwd(), "node_modules", ".pnpm");

if (!existsSync(src)) {
  console.info("[docker-sync-platform-assistant] skip: missing", src);
  process.exit(0);
}
if (!existsSync(pnpmDir)) {
  console.info("[docker-sync-platform-assistant] skip: no .pnpm");
  process.exit(0);
}

let refreshed = 0;
for (const entry of readdirSync(pnpmDir)) {
  if (!entry.startsWith("@private+platform-assistant@")) continue;
  const dst = join(
    pnpmDir,
    entry,
    "node_modules",
    "@private",
    "platform-assistant",
  );
  if (!existsSync(dst)) continue;
  for (const name of readdirSync(src)) {
    if (!name.endsWith(".ts") && name !== "package.json") continue;
    cpSync(join(src, name), join(dst, name));
  }
  refreshed += 1;
}

console.info(
  `[docker-sync-platform-assistant] refreshed ${refreshed} install(s) from ${src}`,
);
