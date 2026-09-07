#!/usr/bin/env node
/**
 * dev:all 就绪探测：轮询各子站端口/HTTP，全部可用后打印汇总表。
 * 由 scripts/dev-all.mjs 在后台拉起；也可单独运行：
 *   node scripts/dev-all-ready.mjs
 *   node scripts/dev-all-ready.mjs --stagger --stagger-sec=3
 */
import net from "node:net";

const WEB_SERVICES = [
  { name: "mall", label: "book-mall", port: 3000 },
  { name: "tool", label: "tool-web", port: 3001 },
  { name: "finance", label: "finance-web", port: 3002 },
  { name: "story", label: "story-web", port: 3003 },
  { name: "canvas", label: "canvas-web", port: 3004 },
  { name: "gateway", label: "gateway-web", port: 3005 },
  { name: "prompt", label: "prompt-optimizer", port: 3006 },
  { name: "ecom", label: "e-commerce-toolkit", port: 3007 },
  { name: "replica", label: "quick-replica-web", port: 3008 },
  { name: "director", label: "director-web", port: 3009 },
  { name: "common", label: "common-tools", port: 3010 },
  { name: "publisher", label: "publisher-web", port: 3011 },
];

const POLL_LOOPS = [
  { name: "story-poll", label: "story:poll-loop" },
  { name: "canvas-poll", label: "canvas:poll-loop" },
  { name: "gateway-poll", label: "gateway:poll-loop" },
];

const GRN = "\x1b[32m";
const YEL = "\x1b[33m";
const RED = "\x1b[31m";
const CYN = "\x1b[36m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const RST = "\x1b[0m";

function parseFlag(name) {
  return process.argv.includes(name);
}

function parseNumFlag(prefix, fallback) {
  for (const arg of process.argv) {
    if (arg.startsWith(`${prefix}=`)) {
      const n = Number(arg.slice(prefix.length + 1));
      if (Number.isFinite(n) && n >= 0) return n;
    }
  }
  return fallback;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function tcpProbe(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: "127.0.0.1" }, () => {
      socket.end();
      resolve(true);
    });
    socket.on("error", () => resolve(false));
    socket.setTimeout(900, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function httpProbe(url) {
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
      /** dev 冷编译时首页常 >5s，4s 会误判「未就绪」 */
      signal: AbortSignal.timeout(15_000),
    });
    return res.status < 500;
  } catch {
    return false;
  }
}

function padRight(str, width) {
  return str.length >= width ? str : str + " ".repeat(width - str.length);
}

function formatElapsed(ms) {
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m${sec % 60}s`;
}

function computeMaxWaitMs(withStagger, staggerSec) {
  /** 首个汇总表：非 stagger 约 3min；stagger 需等末站延迟 + 编译 */
  const compileBudgetMs = 180_000;
  if (!withStagger) return compileBudgetMs;
  const lastStartMs = staggerSec * (WEB_SERVICES.length - 1) * 1000;
  return lastStartMs + compileBudgetMs;
}

/** 绝对上限：部分就绪后继续探测，直到全部就绪或达到此时间 */
const HARD_CAP_MS = 360_000;

function printSummary({ ready, pending, elapsedMs, withPoll, withStagger, pollSettleSec }) {
  const total = WEB_SERVICES.length;
  const okCount = ready.length;
  const allOk = pending.length === 0;

  console.log("");
  console.log(
    `${CYN}${BOLD}══════════════════════════════════════════════════════════════${RST}`,
  );
  if (allOk) {
    console.log(
      `${GRN}${BOLD}  dev:all 就绪 · ${okCount}/${total} 子站可访问 · 用时 ${formatElapsed(elapsedMs)}${RST}`,
    );
  } else {
    console.log(
      `${YEL}${BOLD}  dev:all 部分就绪 · ${okCount}/${total} · 用时 ${formatElapsed(elapsedMs)}${RST}`,
    );
    console.log(
      `${YEL}  其余子站可能仍在编译；就绪探测会继续，全部完成后会再打印一次汇总。${RST}`,
    );
  }
  console.log(
    `${CYN}${BOLD}══════════════════════════════════════════════════════════════${RST}`,
  );

  const labelWidth = Math.max(...WEB_SERVICES.map((s) => s.label.length), 8);
  for (const svc of WEB_SERVICES) {
    const url = `http://localhost:${svc.port}`;
    const isReady = ready.some((r) => r.name === svc.name);
    const mark = isReady ? `${GRN}✓${RST}` : `${RED}○${RST}`;
    console.log(
      `  ${mark} ${padRight(svc.label, labelWidth)}  ${isReady ? url : `${DIM}等待中…${RST}`}`,
    );
  }

  if (withPoll) {
    console.log(`${DIM}  ── 后台 poll-loop（无 HTTP 端口，见终端前缀日志）──${RST}`);
    for (const p of POLL_LOOPS) {
      const note = `${DIM}mall 就绪后约 ${pollSettleSec}s 启动${RST}`;
      console.log(`  ${GRN}·${RST} ${padRight(p.label, labelWidth)}  ${note}`);
    }
  }

  console.log("");
  console.log(`  ${BOLD}开发导航${RST}     http://localhost:3000/dev`);
  console.log(`  ${BOLD}电商工具箱${RST}   http://localhost:3007`);
  console.log(`  ${BOLD}Gateway${RST}      http://localhost:3005`);
  console.log(
    `${CYN}${BOLD}══════════════════════════════════════════════════════════════${RST}`,
  );
  console.log("");
}

async function main() {
  const withStagger = parseFlag("--stagger");
  const withPoll = !parseFlag("--no-poll");
  const staggerSec = parseNumFlag("--stagger-sec", 3);
  const pollSettleSec = parseNumFlag("--poll-settle-sec", 5);
  const maxWaitMs = computeMaxWaitMs(withStagger, staggerSec);
  const pollIntervalMs = 2000;

  const pending = new Map(WEB_SERVICES.map((s) => [s.name, s]));
  const ready = [];
  const start = Date.now();
  let partialPrinted = false;

  // 给 concurrently 一点时间 fork 子进程
  await sleep(1500);

  while (pending.size > 0 && Date.now() - start < HARD_CAP_MS) {
    const batch = [...pending.values()];
    await Promise.all(
      batch.map(async (svc) => {
        if (!(await tcpProbe(svc.port))) return;
        const url = `http://localhost:${svc.port}`;
        if (!(await httpProbe(url))) return;
        pending.delete(svc.name);
        ready.push({ ...svc, url });
      }),
    );

    if (pending.size === 0) {
      ready.sort(
        (a, b) =>
          WEB_SERVICES.findIndex((s) => s.name === a.name) -
          WEB_SERVICES.findIndex((s) => s.name === b.name),
      );
      printSummary({
        ready,
        pending: [],
        elapsedMs: Date.now() - start,
        withPoll,
        withStagger,
        pollSettleSec,
      });
      return;
    }

    const elapsed = Date.now() - start;
    if (!partialPrinted && elapsed >= maxWaitMs) {
      ready.sort(
        (a, b) =>
          WEB_SERVICES.findIndex((s) => s.name === a.name) -
          WEB_SERVICES.findIndex((s) => s.name === b.name),
      );
      printSummary({
        ready,
        pending: [...pending.values()],
        elapsedMs: elapsed,
        withPoll,
        withStagger,
        pollSettleSec,
      });
      partialPrinted = true;
    }

    await sleep(pollIntervalMs);
  }

  ready.sort(
    (a, b) =>
      WEB_SERVICES.findIndex((s) => s.name === a.name) -
      WEB_SERVICES.findIndex((s) => s.name === b.name),
  );

  printSummary({
    ready,
    pending: [...pending.values()],
    elapsedMs: Date.now() - start,
    withPoll,
    withStagger,
    pollSettleSec,
  });
}

main().catch((e) => {
  console.error("[dev-all-ready]", e);
  process.exit(1);
});
