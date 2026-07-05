#!/usr/bin/env node
/**
 * 对比本地 / 线上 splat 代理下载速度（与浏览器同路径）。
 *
 * 用法：
 *   # 1) 浏览器登录后，DevTools → Application → Cookie 复制 tools_token
 *   # 2) 本地
 *   node scripts/bench-world-splat.mjs \
 *     --origin http://localhost:3008 \
 *     --world-id 6425f0fd-fed4-4569-9d92-1ea90f5627d0 \
 *     --token "eyJ..."
 *
 *   # 线上
 *   node scripts/bench-world-splat.mjs \
 *     --origin https://qr.ai-code8.com \
 *     --world-id 6425f0fd-fed4-4569-9d92-1ea90f5627d0 \
 *     --token "eyJ..."
 *
 * 或在已登录浏览器直接打开：
 *   /api/world-splat-bench?worldId=6425f0fd-fed4-4569-9d92-1ea90f5627d0
 */
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    origin: { type: "string" },
    "world-id": { type: "string" },
    token: { type: "string" },
  },
});

const origin = values.origin?.replace(/\/$/, "");
const worldId = values["world-id"]?.trim();
const token = values.token?.trim();

if (!origin || !worldId || !token) {
  console.error(
    "用法: node scripts/bench-world-splat.mjs --origin URL --world-id ID --token JWT",
  );
  process.exit(1);
}

const url = `${origin}/api/world-splat-bench?worldId=${encodeURIComponent(worldId)}`;
const res = await fetch(url, {
  headers: { cookie: `tools_token=${token}` },
  cache: "no-store",
});

const data = await res.json().catch(() => ({}));
if (!res.ok) {
  console.error("测速失败:", res.status, data);
  process.exit(1);
}

console.log(JSON.stringify(data, null, 2));
console.log("\n--- 摘要 ---");
console.log(`场景: ${data.displayName ?? data.worldId}`);
console.log(`结论: ${data.summary?.fullResHint ?? "—"}`);
if (data.summary?.compareNote) console.log(data.summary.compareNote);
for (const s of data.samples ?? []) {
  console.log(
    `[${s.tier}] ${s.contentLengthHuman ?? "?"} · 采样 ${(s.sampleBytes / 1024 / 1024).toFixed(2)}MB/${s.sampleMs}ms · ${s.mbPerSec} MB/s · 预计全量 ${s.estimatedFullHuman ?? "—"} · ${s.verdictHint}`,
  );
}
