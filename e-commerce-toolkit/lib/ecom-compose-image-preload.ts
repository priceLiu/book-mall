/** 拼版 html2canvas 前：同域代理图用 fetch+Blob 注入，避免 <img> 并行抢 proxy 槽位导致 12s 误超时 */

const BOOK_MALL_PROXY_PREFIX = "/api/book-mall/";

export type ComposeSheetPreloadProgress = {
  phase: "refs";
  done: number;
  total: number;
  label: string;
};

function perImageTimeoutMs(imageCount: number): number {
  if (imageCount <= 1) return 45_000;
  if (imageCount <= 8) return 60_000;
  return 120_000;
}

/** 小红书长图单页引用图多、画布极高，scale 2 时 html2canvas 常需数分钟 */
export function composeHtml2CanvasScale(stepId: string, refImageCount: number): number {
  if (stepId === "xhs-long") return 1;
  /** 品牌 VI 第 8 步单页竖版汇总引用图多，scale>1 易超 canvas 上限或抓白 */
  if (stepId === "portfolio") return 1;
  if (refImageCount > 12) return 1.5;
  return 2;
}

async function mapWithConcurrency<T>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return;
  const limit = Math.max(1, Math.min(concurrency, items.length));
  let next = 0;
  const workers = Array.from({ length: limit }, async () => {
    for (;;) {
      const i = next;
      next += 1;
      if (i >= items.length) break;
      await fn(items[i]!, i);
    }
  });
  await Promise.all(workers);
}

async function waitForImageElement(
  img: HTMLImageElement,
  label: string,
  timeoutMs: number,
): Promise<void> {
  if (img.complete && img.naturalHeight > 0) return;

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      fn();
    };
    const timer = window.setTimeout(
      () =>
        finish(() =>
          img.naturalHeight > 0
            ? resolve()
            : reject(new Error(`引用图加载超时：${label}`)),
        ),
      timeoutMs,
    );
    img.onload = () =>
      finish(() =>
        img.naturalHeight > 0
          ? resolve()
          : reject(new Error(`引用图未能加载：${label}`)),
      );
    img.onerror = () =>
      finish(() => reject(new Error(`引用图加载失败：${label}（请稍后重试拼版）`)));
  });
}

async function loadProxyImageIntoElement(
  img: HTMLImageElement,
  proxySrc: string,
  label: string,
  timeoutMs: number,
  blobUrls: string[],
): Promise<void> {
  const res = await fetch(proxySrc, { credentials: "include", cache: "no-store" });
  if (!res.ok) {
    let detail = "";
    try {
      const data = (await res.json()) as { error?: string };
      if (typeof data.error === "string" && data.error.trim()) {
        detail = `（${data.error.trim()}）`;
      }
    } catch {
      /* 非 JSON */
    }
    throw new Error(`引用图加载失败：${label}${detail || `（HTTP ${res.status}）`}`);
  }
  const blob = await res.blob();
  if (!blob.type.startsWith("image/") || blob.size < 32) {
    throw new Error(`引用图加载失败：${label}（响应不是有效图片）`);
  }
  const blobUrl = URL.createObjectURL(blob);
  blobUrls.push(blobUrl);

  img.crossOrigin = "anonymous";
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      fn();
    };
    const timer = window.setTimeout(
      () =>
        finish(() =>
          img.naturalHeight > 0
            ? resolve()
            : reject(new Error(`引用图加载超时：${label}`)),
        ),
      timeoutMs,
    );
    img.onload = () =>
      finish(() =>
        img.naturalHeight > 0
          ? resolve()
          : reject(new Error(`引用图未能加载：${label}`)),
      );
    img.onerror = () =>
      finish(() => reject(new Error(`引用图加载失败：${label}（请稍后重试拼版）`)));
    img.src = blobUrl;
  });
}

function isBookMallProxySrc(src: string): boolean {
  return src.includes(BOOK_MALL_PROXY_PREFIX);
}

async function preloadOneComposeImage(
  img: HTMLImageElement,
  timeoutMs: number,
  blobUrls: string[],
): Promise<void> {
  const label = img.alt?.trim() || "成图";
  const src = (img.currentSrc || img.src || "").trim();
  if (!src) {
    throw new Error(`引用图地址为空：${label}`);
  }
  if (img.complete && img.naturalHeight > 0 && !isBookMallProxySrc(src)) {
    return;
  }
  if (isBookMallProxySrc(src)) {
    await loadProxyImageIntoElement(img, src, label, timeoutMs, blobUrls);
  } else {
    img.crossOrigin = "anonymous";
    await waitForImageElement(img, label, timeoutMs);
  }
}

/**
 * 预加载 sheet 内引用图（有限并行）；返回须在 html2canvas 完成后 revoke 的 blob URL。
 */
export async function preloadComposeSheetImages(
  root: HTMLElement,
  opts?: {
    onProgress?: (p: ComposeSheetPreloadProgress) => void;
    concurrency?: number;
  },
): Promise<{ blobUrls: string[]; imageCount: number }> {
  const imgs = Array.from(root.querySelectorAll("img"));
  const blobUrls: string[] = [];
  const timeoutMs = perImageTimeoutMs(imgs.length);
  const total = imgs.length;
  let done = 0;

  const bump = (label: string) => {
    done += 1;
    opts?.onProgress?.({ phase: "refs", done, total, label });
  };

  await mapWithConcurrency(
    imgs,
    opts?.concurrency ?? 6,
    async (img) => {
      const label = img.alt?.trim() || "成图";
      const src = (img.currentSrc || img.src || "").trim();
      if (
        src &&
        img.complete &&
        img.naturalHeight > 0 &&
        !isBookMallProxySrc(src)
      ) {
        bump(label);
        return;
      }
      await preloadOneComposeImage(img, timeoutMs, blobUrls);
      bump(label);
    },
  );

  return { blobUrls, imageCount: total };
}

export function revokeComposeSheetBlobUrls(blobUrls: string[]): void {
  for (const url of blobUrls) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
  }
}

function sampleBandMostlyWhite(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  y0: number,
): boolean {
  const sampleW = Math.min(96, w);
  const sampleH = Math.min(96, h);
  const y = Math.max(0, Math.min(y0, h - sampleH));
  const data = ctx.getImageData(0, y, sampleW, sampleH).data;
  let nonWhite = 0;
  const pixels = sampleW * sampleH;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    if (r < 250 || g < 250 || b < 250) nonWhite += 1;
  }
  return nonWhite / pixels < 0.002;
}

/** html2canvas 产出是否几乎全白（抓图失败时仍会上传空白 PNG） */
export function composeCanvasMostlyBlank(canvas: HTMLCanvasElement): boolean {
  const w = canvas.width;
  const h = canvas.height;
  if (w <= 0 || h <= 0) return true;
  const ctx = canvas.getContext("2d");
  if (!ctx) return true;
  const bands = [0, Math.floor(h * 0.12), Math.floor(h * 0.35), Math.floor(h * 0.55)];
  return bands.every((y) => sampleBandMostlyWhite(ctx, w, h, y));
}
