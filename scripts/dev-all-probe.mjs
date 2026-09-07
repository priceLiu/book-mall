#!/usr/bin/env node
/**
 * dev:all 就绪探测（TCP + HTTP），供 wait-mall / ready 汇总复用。
 */
import net from "node:net";

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function tcpProbe(port) {
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

export async function httpProbe(url, timeoutMs = 15_000) {
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
    return res.status < 500;
  } catch {
    return false;
  }
}

/** 等待 localhost 某端口 HTTP 可用；超时返回 false */
export async function waitForHttpReady(
  port,
  opts = {},
) {
  const timeoutMs = opts.timeoutMs ?? 360_000;
  const pollIntervalMs = opts.pollIntervalMs ?? 2000;
  const url = opts.url ?? `http://localhost:${port}`;
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    if (await tcpProbe(port)) {
      if (await httpProbe(url, opts.httpTimeoutMs ?? 15_000)) {
        return { ok: true, elapsedMs: Date.now() - start };
      }
    }
    await sleep(pollIntervalMs);
  }

  return { ok: false, elapsedMs: Date.now() - start };
}
