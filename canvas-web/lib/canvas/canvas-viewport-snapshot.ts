"use client";

import { toBlob } from "html-to-image";

import { uploadCanvasImage } from "@/lib/canvas-api";
import { pickPersistableProjectThumbnailUrl } from "@/lib/canvas/project-thumbnail";
import type { CanvasGraph } from "@/lib/canvas/types";

/** 截图长边上限：历史列表只用小图，缩到 720 足够且省 OSS 空间 */
const SNAPSHOT_MAX_WIDTH = 720;
const SNAPSHOT_TIMEOUT_MS = 12000;
const SNAPSHOT_PREPARE_TIMEOUT_MS = 4000;
const SNAPSHOT_FALLBACK_BG = "#191919";
/** 跨域图片取不到像素时的占位（1x1 透明），避免整张截图失败 */
const TRANSPARENT_PIXEL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

/** 交互层不进截图：浮动工具条 / 控制面板 / 侧边 + 号 / 顶栏侧栏 */
const EXCLUDED_SELECTORS = [
  "[data-canvas-snapshot-exclude]",
  ".canvas-toolbar-side-panel-overlay-enter",
  ".react-flow__panel",
  ".react-flow__controls",
  ".react-flow__minimap",
  ".react-flow__attribution",
  ".libtv-node-toolbar-portal",
  ".pro2-node-side-plus-layer",
];

function resolveSnapshotBackground(): string {
  try {
    const value = getComputedStyle(document.documentElement)
      .getPropertyValue("--canvas-bg")
      .trim();
    return value || SNAPSHOT_FALLBACK_BG;
  } catch {
    return SNAPSHOT_FALLBACK_BG;
  }
}

function withTimeout<T>(task: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(null), ms);
    task
      .then((value) => {
        window.clearTimeout(timer);
        resolve(value);
      })
      .catch(() => {
        window.clearTimeout(timer);
        resolve(null);
      });
  });
}

function resolveSnapshotRoot(): HTMLElement | null {
  return (
    document.querySelector<HTMLElement>(".canvas-flow-wrap") ??
    document.querySelector<HTMLElement>(".react-flow__renderer") ??
    document.querySelector<HTMLElement>(".react-flow")
  );
}

type SnapshotPrepareResult = {
  restore: () => void;
};

/** 截图前 fitView 一次，避免 pan/zoom 导致 html-to-image 截到空白 */
async function prepareViewportForSnapshot(): Promise<SnapshotPrepareResult> {
  if (typeof window === "undefined") return { restore: () => {} };

  return (
    (await withTimeout(
      new Promise<SnapshotPrepareResult>((resolve) => {
        const onReady = (event: Event) => {
          window.removeEventListener(
            "canvas:viewport-snapshot-ready",
            onReady,
          );
          const detail = (event as CustomEvent<SnapshotPrepareResult>).detail;
          resolve(detail ?? { restore: () => {} });
        };
        window.addEventListener("canvas:viewport-snapshot-ready", onReady, {
          once: true,
        });
        window.dispatchEvent(new CustomEvent("canvas:prepare-viewport-snapshot"));
      }),
      SNAPSHOT_PREPARE_TIMEOUT_MS,
    )) ?? { restore: () => {} }
  );
}

/** 判定截图是否几乎只有背景色（React Flow transform 失败时常出现） */
async function isLikelyBlankSnapshotBlob(blob: Blob): Promise<boolean> {
  if (typeof createImageBitmap !== "function") return false;
  try {
    const bitmap = await createImageBitmap(blob);
    const sampleW = Math.min(bitmap.width, 96);
    const sampleH = Math.min(bitmap.height, 96);
    const canvas = document.createElement("canvas");
    canvas.width = sampleW;
    canvas.height = sampleH;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      bitmap.close();
      return false;
    }
    ctx.drawImage(bitmap, 0, 0, sampleW, sampleH);
    bitmap.close();
    const { data } = ctx.getImageData(0, 0, sampleW, sampleH);
    let interesting = 0;
    const total = sampleW * sampleH;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]!;
      const g = data[i + 1]!;
      const b = data[i + 2]!;
      const a = data[i + 3]!;
      if (a < 20) continue;
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const sat = max - min;
      // 背景 #191919 附近 + 纯黑都视为「无内容」
      if (lum > 48 || sat > 18) interesting += 1;
    }
    return interesting / total < 0.012;
  } catch {
    return false;
  }
}

async function captureViewportBlob(root: HTMLElement): Promise<Blob | null> {
  const rect = root.getBoundingClientRect();
  if (rect.width < 80 || rect.height < 80) return null;

  const pixelRatio = Math.min(
    1.5,
    Math.max(0.5, SNAPSHOT_MAX_WIDTH / rect.width),
  );

  return withTimeout(
    toBlob(root, {
      backgroundColor: resolveSnapshotBackground(),
      pixelRatio,
      cacheBust: true,
      skipFonts: false,
      fetchRequestInit: { mode: "cors", credentials: "omit" },
      imagePlaceholder: TRANSPARENT_PIXEL,
      filter: (node) => {
        if (typeof (node as Element).matches !== "function") return true;
        return !EXCLUDED_SELECTORS.some((selector) =>
          (node as Element).matches(selector),
        );
      },
    }),
    SNAPSHOT_TIMEOUT_MS,
  );
}

/**
 * 历史封面：视口截图优先；空白或失败时用画布内媒体图 / 项目封面。
 */
export function resolveCanvasHistoryThumbnailUrl(
  viewportShot: string,
  graph: CanvasGraph,
  projectThumbnailUrl?: string,
): string {
  const shot = viewportShot?.trim() ?? "";
  if (shot.startsWith("http")) return shot;
  return (
    pickPersistableProjectThumbnailUrl(graph) ||
    projectThumbnailUrl?.trim() ||
    ""
  );
}

/**
 * 截当前画布视口并上传 OSS，返回图片地址。
 * 任何一步失败都返回空串——由 resolveCanvasHistoryThumbnailUrl 回退媒体封面。
 */
export async function captureCanvasViewportSnapshotUrl(
  base: string,
): Promise<string> {
  if (typeof window === "undefined" || !base) return "";
  if (document.visibilityState === "hidden") return "";

  const root = resolveSnapshotRoot();
  if (!root) return "";

  const prepared = await prepareViewportForSnapshot();
  try {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });

    const blob = await captureViewportBlob(root);
    if (!blob || (await isLikelyBlankSnapshotBlob(blob))) return "";

    const file = new File([blob], `canvas-snapshot-${Date.now()}.png`, {
      type: "image/png",
    });
    return await uploadCanvasImage(base, file);
  } catch {
    return "";
  } finally {
    prepared.restore();
  }
}
