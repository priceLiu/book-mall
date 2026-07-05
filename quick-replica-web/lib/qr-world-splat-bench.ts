/** 采样下载 splat，估算全量耗时（不拉完整 full_res） */

export type SplatBenchSample = {
  tier: string;
  url: string;
  status: number;
  ok: boolean;
  contentLength: number | null;
  contentLengthHuman: string | null;
  sampleBytes: number;
  sampleMs: number;
  bytesPerSec: number;
  mbPerSec: number;
  estimatedFullSec: number | null;
  estimatedFullHuman: string | null;
  acceptsRange: boolean;
  error?: string;
};

const SAMPLE_BYTES = 2 * 1024 * 1024;

function formatBytes(n: number): string {
  if (n >= 1024 * 1024 * 1024) return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${n} B`;
}

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec.toFixed(1)}s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}m${s}s`;
}

function parseContentLength(res: Response): number | null {
  const raw = res.headers.get("content-length");
  if (raw) {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  const range = res.headers.get("content-range");
  if (range) {
    const m = /\/(\d+)\s*$/.exec(range);
    if (m) {
      const n = Number.parseInt(m[1]!, 10);
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return null;
}

async function readSampleBody(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
): Promise<number> {
  if (!body) return 0;
  const reader = body.getReader();
  let total = 0;
  try {
    while (total < maxBytes) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      total += value.byteLength;
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      /* ignore */
    }
  }
  return total;
}

export async function benchSplatDownload(args: {
  tier: string;
  url: string;
  fetchInit?: RequestInit;
  sampleBytes?: number;
}): Promise<SplatBenchSample> {
  const sampleBytes = args.sampleBytes ?? SAMPLE_BYTES;
  const started = performance.now();

  try {
    let contentLength: number | null = null;
    try {
      const head = await fetch(args.url, {
        ...args.fetchInit,
        method: "HEAD",
        cache: "no-store",
      });
      contentLength = parseContentLength(head);
    } catch {
      /* HEAD 可能未实现，忽略 */
    }

    const rangeRes = await fetch(args.url, {
      ...args.fetchInit,
      headers: {
        ...(args.fetchInit?.headers instanceof Headers
          ? Object.fromEntries(args.fetchInit.headers.entries())
          : (args.fetchInit?.headers as Record<string, string> | undefined)),
        Range: `bytes=0-${sampleBytes - 1}`,
      },
      cache: "no-store",
    });

    const acceptsRange = rangeRes.status === 206;
    let sampleRead = 0;
    let status = rangeRes.status;

    if (rangeRes.ok) {
      sampleRead = await readSampleBody(rangeRes.body, sampleBytes);
      if (!contentLength) contentLength = parseContentLength(rangeRes);
    } else {
      const fullRes = await fetch(args.url, { ...args.fetchInit, cache: "no-store" });
      status = fullRes.status;
      if (!fullRes.ok) {
        return {
          tier: args.tier,
          url: args.url,
          status,
          ok: false,
          contentLength,
          contentLengthHuman: contentLength != null ? formatBytes(contentLength) : null,
          sampleBytes: 0,
          sampleMs: Math.round(performance.now() - started),
          bytesPerSec: 0,
          mbPerSec: 0,
          estimatedFullSec: null,
          estimatedFullHuman: null,
          acceptsRange: false,
          error: `HTTP ${status}`,
        };
      }
      if (!contentLength) contentLength = parseContentLength(fullRes);
      sampleRead = await readSampleBody(fullRes.body, sampleBytes);
    }

    const sampleMs = Math.max(1, Math.round(performance.now() - started));
    const bytesPerSec = (sampleRead / sampleMs) * 1000;
    const estimatedFullSec =
      contentLength && sampleRead > 0 ? contentLength / bytesPerSec : null;

    return {
      tier: args.tier,
      url: args.url,
      status,
      ok: sampleRead > 0,
      contentLength,
      contentLengthHuman: contentLength != null ? formatBytes(contentLength) : null,
      sampleBytes: sampleRead,
      sampleMs,
      bytesPerSec: Math.round(bytesPerSec),
      mbPerSec: Math.round((bytesPerSec / (1024 * 1024)) * 100) / 100,
      estimatedFullSec,
      estimatedFullHuman:
        estimatedFullSec != null ? formatDuration(estimatedFullSec) : null,
      acceptsRange,
    };
  } catch (err) {
    return {
      tier: args.tier,
      url: args.url,
      status: 0,
      ok: false,
      contentLength: null,
      contentLengthHuman: null,
      sampleBytes: 0,
      sampleMs: Math.round(performance.now() - started),
      bytesPerSec: 0,
      mbPerSec: 0,
      estimatedFullSec: null,
      estimatedFullHuman: null,
      acceptsRange: false,
      error: err instanceof Error ? err.message : "fetch_failed",
    };
  }
}

export type SplatBenchVerdict = "fast" | "ok" | "slow" | "very_slow";

export function verdictForBench(sample: SplatBenchSample): SplatBenchVerdict {
  if (!sample.ok || sample.mbPerSec <= 0) return "very_slow";
  if (sample.mbPerSec >= 2) return "fast";
  if (sample.mbPerSec >= 0.5) return "ok";
  if (sample.mbPerSec >= 0.15) return "slow";
  return "very_slow";
}

export const SPLAT_BENCH_VERDICT_HINT: Record<SplatBenchVerdict, string> = {
  fast: "速度正常（与本地接近）",
  ok: "可接受，高清档约 1～3 分钟",
  slow: "偏慢，高清档可能 3～8 分钟",
  very_slow: "异常偏慢，请检查 BFF 是否已部署流式转发或网络/代理",
};
