#!/usr/bin/env node
/**
 * 阻塞直到 book-mall (:3000) HTTP 就绪；就绪后再等待若干秒再退出（减 P2028 连接池峰值）。
 *
 *   node scripts/dev-all-wait-mall.mjs
 *   DEV_ALL_MALL_SETTLE_SEC=20 node scripts/dev-all-wait-mall.mjs
 */
import { sleep, waitForHttpReady } from "./dev-all-probe.mjs";

const YEL = "\x1b[33m";
const GRN = "\x1b[32m";
const DIM = "\x1b[2m";
const RST = "\x1b[0m";

function mallSettleSec() {
  const raw = process.env.DEV_ALL_MALL_SETTLE_SEC?.trim();
  const n = raw ? Number(raw) : 20;
  return Number.isFinite(n) && n >= 0 ? n : 20;
}

async function main() {
  const settleSec = mallSettleSec();
  process.stderr.write(`${YEL}[dev-all] 等待 book-mall (localhost:3000) 就绪…${RST}\n`);

  const result = await waitForHttpReady(3000);

  if (result.ok) {
    const sec = Math.round(result.elapsedMs / 1000);
    if (settleSec > 0) {
      process.stderr.write(
        `${GRN}[dev-all] book-mall 已就绪 (${sec}s)，再等待 ${settleSec}s 以减轻连接池峰值…${RST}\n`,
      );
      await sleep(settleSec * 1000);
    } else {
      process.stderr.write(
        `${GRN}[dev-all] book-mall 已就绪 (${sec}s)，启动本子站…${RST}\n`,
      );
    }
    process.stderr.write(`${DIM}[dev-all] 启动本子站…${RST}\n`);
    process.exit(0);
  }

  process.stderr.write(
    `${YEL}[dev-all] book-mall 等待超时，仍尝试启动本子站（请查看 [mall] 日志）${RST}\n`,
  );
  process.exit(0);
}

main().catch((e) => {
  console.error("[dev-all-wait-mall]", e);
  process.exit(0);
});
