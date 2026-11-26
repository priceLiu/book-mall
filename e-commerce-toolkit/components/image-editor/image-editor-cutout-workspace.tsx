"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import {
  Ban,
  Check,
  ChevronDown,
  ChevronUp,
  Hand,
  Minus,
  Move,
  Plus,
  Redo2,
  Shirt,
  ShoppingBag,
  Star,
  Undo2,
  UserRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { useDialogs } from "@/components/dialogs/dialog-provider";
import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { submitImageProcessingEdit } from "@/lib/ecom-image-processing-api";
import { ecomMediaFetchUrl } from "@/lib/ecom-media-download";
import { encodeCutoutPsd } from "@/lib/image-editor-psd";
import { cn } from "@/lib/utils";

const SEEDREAM_CUTOUT_MODEL = "doubao-seedream-5-5";

const SUBJECTS: Array<{ id: string; label: string; icon: LucideIcon }> = [
  { id: "off", label: "关闭", icon: Ban },
  { id: "portrait", label: "人像宠物", icon: UserRound },
  { id: "product", label: "商品货物", icon: ShoppingBag },
  { id: "icon", label: "图标印章", icon: Star },
  { id: "apparel", label: "服饰", icon: Shirt },
];

const CHECKER: CSSProperties = {
  backgroundColor: "#f4efe8",
  backgroundImage:
    "linear-gradient(45deg, #d9d1c6 25%, transparent 25%), linear-gradient(-45deg, #d9d1c6 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #d9d1c6 75%), linear-gradient(-45deg, transparent 75%, #d9d1c6 75%)",
  backgroundSize: "16px 16px",
  backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0",
};

type Props = {
  imageUrl: string;
  onCancel: () => void;
  onApply: (url: string) => void;
  /** 顶栏下载与「确定」共用同一组选项。数值变大时打开选择。 */
  saveRequest?: number;
  /** 刷新后恢复的主体与结果。有结果时本次打开不再请求模型。 */
  initialSubject?: string;
  initialResultUrl?: string | null;
  onSessionChange?: (subject: string, resultUrl: string | null) => void;
};

type NormRect = { x: number; y: number; w: number; h: number };
type ImageLayout = { dx: number; dy: number; dw: number; dh: number };

const BOX_HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const;

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function normalizeRect(x0: number, y0: number, x1: number, y1: number): NormRect {
  const left = clamp01(Math.min(x0, x1));
  const top = clamp01(Math.min(y0, y1));
  const right = clamp01(Math.max(x0, x1));
  const bottom = clamp01(Math.max(y0, y1));
  return { x: left, y: top, w: Math.max(0, right - left), h: Math.max(0, bottom - top) };
}

function handleCursor(handle: string): string {
  if (handle === "n" || handle === "s") return "ns-resize";
  if (handle === "e" || handle === "w") return "ew-resize";
  if (handle === "ne" || handle === "sw") return "nesw-resize";
  return "nwse-resize";
}

function resizedBox(box: NormRect, handle: string, x: number, y: number): NormRect {
  let x0 = box.x;
  let y0 = box.y;
  let x1 = box.x + box.w;
  let y1 = box.y + box.h;
  if (handle.includes("w")) x0 = x;
  if (handle.includes("e")) x1 = x;
  if (handle.includes("n")) y0 = y;
  if (handle.includes("s")) y1 = y;
  const next = normalizeRect(x0, y0, x1, y1);
  if (next.w < 0.02 || next.h < 0.02) return box;
  return next;
}

function handleStyle(handle: string): CSSProperties {
  const style: CSSProperties = {};
  if (handle.includes("n")) style.top = 0;
  else if (handle.includes("s")) style.top = "100%";
  else style.top = "50%";
  if (handle.includes("w")) style.left = 0;
  else if (handle.includes("e")) style.left = "100%";
  else style.left = "50%";
  return style;
}

async function urlToDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("读取图片失败"));
    reader.readAsDataURL(blob);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  const once = (cors: boolean) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      if (cors) img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("图片加载失败"));
      img.src = src;
    });
  return once(true).catch(() => once(false));
}

const HISTORY_LIMIT = 5;

function readAlpha(canvas: HTMLCanvasElement): Uint8ClampedArray | null {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  try {
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const alpha = new Uint8ClampedArray(canvas.width * canvas.height);
    for (let i = 0; i < alpha.length; i += 1) alpha[i] = img.data[i * 4 + 3] ?? 0;
    return alpha;
  } catch {
    return null;
  }
}

function writeAlpha(canvas: HTMLCanvasElement, alpha: Uint8ClampedArray) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const n = Math.min(alpha.length, canvas.width * canvas.height);
  for (let i = 0; i < n; i += 1) img.data[i * 4 + 3] = alpha[i] ?? 0;
  ctx.putImageData(img, 0, 0);
}

const SMART_THRESH = 22 * 22;
/** 只在笔刷周围扩一圈，顺着笔下的颜色找边，不走到整张图。 */
const SMART_REACH = 2.2;

type SmartReach = { x: number; y: number; max: number; r: number; g: number; b: number };

type PaintStroke = {
  img: ImageData;
  color: Uint8ClampedArray;
  seen: Uint8Array | null;
  seedOf: Int32Array | null;
  reaches: SmartReach[];
  queue: number[];
  head: number;
  mode: "remove" | "keep";
  kind: "manual" | "smart";
  lastX: number;
  lastY: number;
};

/** 同域拉图。透明像素的颜色经常是黑的，颜色一律用原图，抠图结果只提供透明通道。 */
async function fetchBitmap(src: string): Promise<ImageBitmap> {
  const res = await fetch(ecomMediaFetchUrl(src), { credentials: "include" });
  if (!res.ok) throw new Error("读取抠图结果失败");
  return createImageBitmap(await res.blob());
}

async function loadEditableCanvas(
  cutoutSrc: string,
  originalSrc: string,
): Promise<{ color: HTMLCanvasElement; mask: HTMLCanvasElement }> {
  const [cutout, original] = await Promise.all([fetchBitmap(cutoutSrc), fetchBitmap(originalSrc)]);
  const color = document.createElement("canvas");
  color.width = original.width;
  color.height = original.height;
  const colorCtx = color.getContext("2d", { willReadFrequently: true });
  if (!colorCtx) throw new Error("无法编辑抠图");
  colorCtx.drawImage(original, 0, 0);
  const mask = document.createElement("canvas");
  mask.width = color.width;
  mask.height = color.height;
  const maskCtx = mask.getContext("2d", { willReadFrequently: true });
  if (!maskCtx) throw new Error("无法编辑抠图");
  maskCtx.drawImage(cutout, 0, 0, mask.width, mask.height);
  const alpha = maskCtx.getImageData(0, 0, mask.width, mask.height);
  const white = maskCtx.createImageData(mask.width, mask.height);
  for (let i = 0; i < white.data.length; i += 4) {
    white.data[i] = 255;
    white.data[i + 1] = 255;
    white.data[i + 2] = 255;
    white.data[i + 3] = alpha.data[i + 3] ?? 0;
  }
  maskCtx.putImageData(white, 0, 0);
  cutout.close();
  original.close();
  return { color, mask };
}

/** 手动修补：只改笔刷经过的像素，硬度决定边缘软硬。 */
function stampInto(
  img: ImageData,
  cx: number,
  cy: number,
  radius: number,
  mode: "remove" | "keep",
  hardness: number,
) {
  if (radius <= 0) return;
  const { width, height, data } = img;
  const r = Math.ceil(radius);
  const x0 = Math.max(0, Math.floor(cx - r));
  const y0 = Math.max(0, Math.floor(cy - r));
  const x1 = Math.min(width, Math.ceil(cx + r));
  const y1 = Math.min(height, Math.ceil(cy + r));
  const inner = radius * (Math.max(0, Math.min(100, hardness)) / 100);
  const target = mode === "remove" ? 0 : 255;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const dist = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (dist > radius) continue;
      let strength = 1;
      if (dist > inner && radius > inner) strength = 1 - (dist - inner) / (radius - inner);
      const p = (y * width + x) * 4 + 3;
      const cur = data[p] ?? 0;
      data[p] = Math.round(cur + (target - cur) * strength);
    }
  }
}

function stampSegment(
  img: ImageData,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  radius: number,
  mode: "remove" | "keep",
  hardness: number,
) {
  const dist = Math.hypot(x1 - x0, y1 - y0);
  const step = Math.max(1, radius * 0.35);
  const n = Math.max(1, Math.ceil(dist / step));
  for (let i = 0; i <= n; i += 1) {
    const t = i / n;
    stampInto(img, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, radius, mode, hardness);
  }
}

function seedDisk(
  img: ImageData,
  color: Uint8ClampedArray,
  seen: Uint8Array,
  seedOf: Int32Array,
  reaches: SmartReach[],
  queue: number[],
  cx: number,
  cy: number,
  radius: number,
) {
  const { width, height } = img;
  const r = Math.max(1, Math.round(radius));
  const r2 = r * r;
  const sx = Math.max(0, Math.min(width - 1, Math.round(cx)));
  const sy = Math.max(0, Math.min(height - 1, Math.round(cy)));
  const cp = (sy * width + sx) * 4;
  const reachId = reaches.length;
  reaches.push({
    x: sx,
    y: sy,
    max: Math.max(r + 6, radius * SMART_REACH),
    r: color[cp] ?? 0,
    g: color[cp + 1] ?? 0,
    b: color[cp + 2] ?? 0,
  });
  for (let y = Math.max(0, sy - r); y <= Math.min(height - 1, sy + r); y += 1) {
    for (let x = Math.max(0, sx - r); x <= Math.min(width - 1, sx + r); x += 1) {
      const dx = x - sx;
      const dy = y - sy;
      if (dx * dx + dy * dy > r2) continue;
      const idx = y * width + x;
      if (seen[idx]) continue;
      seen[idx] = 1;
      seedOf[idx] = reachId;
      queue.push(idx);
    }
  }
}

/** 智能选区只在这一笔周围扩开，颜色要接近笔下的颜色。 */
function drainSmart(
  img: ImageData,
  color: Uint8ClampedArray,
  seen: Uint8Array,
  seedOf: Int32Array,
  reaches: SmartReach[],
  queue: number[],
  head: number,
  mode: "remove" | "keep",
  budget: number,
): number {
  const { width, data } = img;
  const total = img.width * img.height;
  const target = mode === "remove" ? 0 : 255;
  const end = head + budget;
  let i = head;
  while (i < end && i < queue.length) {
    const idx = queue[i]!;
    i += 1;
    const reach = reaches[seedOf[idx] ?? 0];
    if (!reach) continue;
    data[idx * 4 + 3] = target;
    const x = idx % width;
    const y = Math.floor(idx / width);
    const neighbors = [idx - 1, idx + 1, idx - width, idx + width];
    for (const next of neighbors) {
      if (next < 0 || next >= total || seen[next]) continue;
      const nx = next % width;
      const ny = Math.floor(next / width);
      if (Math.abs(nx - x) + Math.abs(ny - y) !== 1) continue;
      const dx = nx - reach.x;
      const dy = ny - reach.y;
      if (dx * dx + dy * dy > reach.max * reach.max) continue;
      const p = next * 4;
      const dr = reach.r - (color[p] ?? 0);
      const dg = reach.g - (color[p + 1] ?? 0);
      const db = reach.b - (color[p + 2] ?? 0);
      if (dr * dr + dg * dg + db * db > SMART_THRESH) continue;
      seen[next] = 1;
      seedOf[next] = seedOf[idx] ?? 0;
      queue.push(next);
    }
  }
  return i;
}

/** 左边：原图，抠完后只在主体像素上叠选区。框选时选区和右边预览都只留框内。 */
function CutoutPane({
  src,
  selectionSrc,
  bitmap,
  bitmapRev = 0,
  underlay,
  maskCanvas,
  maskRev = 0,
  checker,
  zoom,
  pan,
  alt,
  crop,
  clip,
  onLayout,
}: {
  src: string;
  selectionSrc?: string | null;
  bitmap?: HTMLCanvasElement | null;
  bitmapRev?: number;
  /** 预览用原图上色，再按遮罩挖空。不能直接画遮罩，透明处的颜色是黑的。 */
  underlay?: HTMLCanvasElement | null;
  maskCanvas?: HTMLCanvasElement | null;
  maskRev?: number;
  checker?: boolean;
  zoom: number;
  pan: { x: number; y: number };
  alt: string;
  crop?: NormRect | null;
  clip?: "selection" | "image" | null;
  onLayout?: (layout: ImageLayout) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cacheRef = useRef<{ src: string; img: HTMLImageElement; maskSrc: string | null; mask: HTMLImageElement | null } | null>(null);
  const onLayoutRef = useRef(onLayout);
  onLayoutRef.current = onLayout;

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    let seq = 0;
    const draw = async () => {
      const ticket = ++seq;
      const maskSrc = selectionSrc ?? null;
      let img: HTMLImageElement;
      let mask: HTMLImageElement | null;
      const cached = cacheRef.current;
      if (cached && cached.src === src && cached.maskSrc === maskSrc) {
        img = cached.img;
        mask = cached.mask;
      } else {
        img = await loadImage(src);
        mask = maskSrc ? await loadImage(maskSrc).catch(() => null) : null;
        if (ticket !== seq) return;
        cacheRef.current = { src, img, maskSrc, mask };
      }
      const source: CanvasImageSource = bitmap ?? img;
      const sized = underlay ?? bitmap;
      const sw = sized ? sized.width : img.naturalWidth;
      const sh = sized ? sized.height : img.naturalHeight;
      if (!sw || !sh) return;
      const rect = wrap.getBoundingClientRect();
      const w = Math.max(1, rect.width);
      const h = Math.max(1, rect.height);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const fit = Math.min(w / sw, h / sh);
      const scale = fit * (zoom / 100);
      const dw = sw * scale;
      const dh = sh * scale;
      const dx = (w - dw) / 2 + pan.x;
      const dy = (h - dh) / 2 + pan.y;
      onLayoutRef.current?.({ dx, dy, dw, dh });
      const maskSource: CanvasImageSource | null = maskCanvas ?? (mask?.naturalWidth ? mask : null);
      ctx.save();
      if (crop && clip === "image" && crop.w > 0 && crop.h > 0) {
        ctx.beginPath();
        ctx.rect(dx + crop.x * dw, dy + crop.y * dh, crop.w * dw, crop.h * dh);
        ctx.clip();
      }
      if (underlay) {
        ctx.drawImage(underlay, dx, dy, dw, dh);
        if (maskSource) {
          ctx.globalCompositeOperation = "destination-in";
          ctx.drawImage(maskSource, dx, dy, dw, dh);
        }
        ctx.restore();
        return;
      }
      ctx.drawImage(source, dx, dy, dw, dh);
      ctx.restore();
      if (!maskSource || clip === "image") return;
      const off = document.createElement("canvas");
      off.width = Math.max(1, Math.round(dw));
      off.height = Math.max(1, Math.round(dh));
      const octx = off.getContext("2d");
      if (!octx) return;
      octx.fillStyle = "rgba(90, 160, 255, 0.45)";
      octx.fillRect(0, 0, off.width, off.height);
      octx.globalCompositeOperation = "destination-in";
      octx.drawImage(maskSource, 0, 0, off.width, off.height);
      if (crop && clip === "selection" && crop.w > 0 && crop.h > 0) {
        octx.fillStyle = "#fff";
        octx.fillRect(crop.x * off.width, crop.y * off.height, crop.w * off.width, crop.h * off.height);
      }
      ctx.drawImage(off, dx, dy);
    };
    void draw();
    const ro = new ResizeObserver(() => void draw());
    ro.observe(wrap);
    return () => {
      seq += 1;
      ro.disconnect();
    };
  }, [bitmap, bitmapRev, clip, crop, maskCanvas, maskRev, pan.x, pan.y, selectionSrc, src, underlay, zoom]);

  return (
    <div ref={wrapRef} className="absolute inset-0" style={checker ? CHECKER : { backgroundColor: "#fff" }}>
      <canvas ref={canvasRef} className="h-full w-full" role="img" aria-label={alt} />
    </div>
  );
}

function ModeChoice({
  name,
  value,
  current,
  open,
  onChange,
}: {
  name: string;
  value: "remove" | "keep";
  current: "remove" | "keep";
  open: boolean;
  onChange: (value: "remove" | "keep") => void;
}) {
  const checked = open && current === value;
  const Icon = value === "remove" ? Minus : Plus;
  return (
    <label
      className={cn(
        "inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[12px]",
        checked && value === "remove" && "bg-[#f3f1ef] text-[#e11d48]",
        checked && value === "keep" && "bg-[#e7f0ff] text-[#2563eb]",
        !checked && "text-[var(--ie-ink)]",
      )}
    >
      <input type="radio" name={name} className="sr-only" checked={checked} onChange={() => onChange(value)} />
      <span
        className={cn(
          "grid h-4 w-4 place-items-center rounded-full",
          !open && "border border-current",
        )}
      >
        <Icon className="h-2.5 w-2.5" aria-hidden />
      </span>
      {value === "remove" ? "去除" : "保留"}
    </label>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  const set = (next: number) => onChange(Math.max(min, Math.min(max, Math.round(next))));
  return (
    <div className="flex items-center gap-2 text-[12px] text-[var(--ie-ink)]">
      <span className="w-[4.5rem] shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        aria-label={label}
        className="h-1 min-w-0 flex-1 accent-[#3b82f6]"
        onChange={(event) => set(Number(event.target.value))}
      />
      <div className="flex h-7 shrink-0 items-center rounded-md border border-[var(--ie-border-soft)] bg-white">
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          aria-label={`${label}数值`}
          className="w-9 bg-transparent text-center text-[12px] outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          onChange={(event) => set(Number(event.target.value))}
        />
        <div className="flex h-full flex-col border-l border-[var(--ie-border-soft)]">
          <button type="button" aria-label={`${label}增大`} className="grid flex-1 place-items-center px-1" onClick={() => set(value + 1)}>
            <ChevronUp className="h-3 w-3" aria-hidden />
          </button>
          <button type="button" aria-label={`${label}减小`} className="grid flex-1 place-items-center px-1" onClick={() => set(value - 1)}>
            <ChevronDown className="h-3 w-3" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}

export function ImageEditorCutoutWorkspace({
  imageUrl,
  onCancel,
  onApply,
  saveRequest = 0,
  initialSubject = "portrait",
  initialResultUrl = null,
  onSessionChange,
}: Props) {
  const { alert } = useDialogs();
  const [subject, setSubject] = useState(initialSubject);
  const [saveOpen, setSaveOpen] = useState(false);
  const seenSaveRequest = useRef(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [smartMode, setSmartMode] = useState<"remove" | "keep">("remove");
  const [brushMode, setBrushMode] = useState<"remove" | "keep">("remove");
  const [tool, setTool] = useState<"smart" | "manual" | null>(null);
  const [brushSize, setBrushSize] = useState(40);
  const [brushHardness, setBrushHardness] = useState(100);
  const [showPreview, setShowPreview] = useState(true);
  const [boxSelect, setBoxSelect] = useState(false);
  const [cropBox, setCropBox] = useState<NormRect | null>(null);
  const [imageLayout, setImageLayout] = useState<ImageLayout | null>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<
    | { kind: "new"; x0: number; y0: number }
    | { kind: "move"; x0: number; y0: number; box: NormRect }
    | { kind: "resize"; handle: string; box: NormRect }
    | null
  >(null);
  const [zoom, setZoom] = useState(100);
  const [hand, setHand] = useState(false);
  const [panning, setPanning] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [resultUrl, setResultUrl] = useState<string | null>(initialResultUrl);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [workCanvas, setWorkCanvas] = useState<HTMLCanvasElement | null>(null);
  const [colorCanvas, setColorCanvas] = useState<HTMLCanvasElement | null>(null);
  const [paintRev, setPaintRev] = useState(0);
  const [hist, setHist] = useState({ undo: 0, redo: 0 });
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const requestId = useRef(0);
  const undoRef = useRef<Uint8ClampedArray[]>([]);
  const redoRef = useRef<Uint8ClampedArray[]>([]);
  const workRef = useRef<HTMLCanvasElement | null>(null);
  workRef.current = workCanvas;
  const colorRef = useRef<HTMLCanvasElement | null>(null);
  colorRef.current = colorCanvas;
  const strokeRef = useRef<PaintStroke | null>(null);
  const pumpRef = useRef(0);
  const paintingRef = useRef(false);
  const panDragRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const restoredKey = useRef(
    initialResultUrl && initialSubject !== "off" ? `${imageUrl}|${initialSubject}` : "",
  );

  const current = SUBJECTS.find((item) => item.id === subject) ?? SUBJECTS[1]!;

  useEffect(() => {
    if (!running) return;
    setProgress(8);
    const timer = window.setInterval(() => {
      setProgress((value) => (value >= 92 ? value : value + Math.max(1, Math.round((92 - value) * 0.12))));
    }, 450);
    return () => window.clearInterval(timer);
  }, [running]);

  useEffect(() => {
    onSessionChange?.(subject, resultUrl);
  }, [onSessionChange, resultUrl, subject]);

  useEffect(() => {
    const key = `${imageUrl}|${subject}`;
    if (retry === 0 && restoredKey.current && restoredKey.current === key) return;
    restoredKey.current = "";
    if (subject === "off") {
      requestId.current += 1;
      setRunning(false);
      setProgress(0);
      setResultUrl(null);
      setError(null);
      return;
    }
    const id = ++requestId.current;
    let cancelled = false;
    setRunning(true);
    setError(null);
    setResultUrl(null);
    void (async () => {
      try {
        const dataUrl = await urlToDataUrl(imageUrl);
        if (cancelled || id !== requestId.current) return;
        const res = await submitImageProcessingEdit({
          mode: "bg-remove",
          model: SEEDREAM_CUTOUT_MODEL,
          generativeModel: SEEDREAM_CUTOUT_MODEL,
          sourceImageDataUrl: dataUrl,
          bgMode: "transparent",
          edgeQuality: "high",
          outputFormat: "png",
          cutoutSubject: subject,
        });
        if (cancelled || id !== requestId.current) return;
        const next = res.imageUrls[0];
        if (!next) throw new Error("未返回抠图结果");
        setResultUrl(next);
        setProgress(100);
      } catch (e) {
        if (cancelled || id !== requestId.current) return;
        setError(e instanceof Error ? e.message : "抠图失败");
      } finally {
        if (!cancelled && id === requestId.current) setRunning(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [imageUrl, retry, subject]);

  useEffect(() => {
    if (!resultUrl) {
      setWorkCanvas(null);
      setColorCanvas(null);
      undoRef.current = [];
      redoRef.current = [];
      setHist({ undo: 0, redo: 0 });
      return;
    }
    let cancelled = false;
    void loadEditableCanvas(resultUrl, imageUrl).then(({ color, mask }) => {
      if (cancelled) return;
      undoRef.current = [];
      redoRef.current = [];
      setHist({ undo: 0, redo: 0 });
      setColorCanvas(color);
      setWorkCanvas(mask);
      setPaintRev((value) => value + 1);
    }).catch((e) => {
      if (cancelled) return;
      setWorkCanvas(null);
      setColorCanvas(null);
      setError(e instanceof Error ? e.message : "抠图结果无法编辑");
    });
    return () => {
      cancelled = true;
    };
  }, [imageUrl, resultUrl]);

  const syncHist = () => setHist({ undo: undoRef.current.length, redo: redoRef.current.length });

  const pushUndo = () => {
    const canvas = workCanvas;
    if (!canvas) return;
    const alpha = readAlpha(canvas);
    if (!alpha) return;
    undoRef.current.push(alpha);
    if (undoRef.current.length > HISTORY_LIMIT) undoRef.current.shift();
    redoRef.current = [];
    syncHist();
  };

  const undo = () => {
    const canvas = workCanvas;
    const prev = undoRef.current.pop();
    if (!canvas || !prev) return;
    const current = readAlpha(canvas);
    if (current) redoRef.current.push(current);
    writeAlpha(canvas, prev);
    setPaintRev((value) => value + 1);
    syncHist();
  };

  const redo = () => {
    const canvas = workCanvas;
    const next = redoRef.current.pop();
    if (!canvas || !next) return;
    const current = readAlpha(canvas);
    if (current) {
      undoRef.current.push(current);
      if (undoRef.current.length > HISTORY_LIMIT) undoRef.current.shift();
    }
    writeAlpha(canvas, next);
    setPaintRev((value) => value + 1);
    syncHist();
  };

  const imagePoint = (event: ReactPointerEvent<HTMLElement>) => {
    if (!imageLayout || !workCanvas) return null;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    return {
      x: ((x - imageLayout.dx) / Math.max(1, imageLayout.dw)) * workCanvas.width,
      y: ((y - imageLayout.dy) / Math.max(1, imageLayout.dh)) * workCanvas.height,
    };
  };

  const brushRadius = () => {
    if (!imageLayout || !workCanvas) return brushSize / 2;
    return (brushSize / 2) * (workCanvas.width / Math.max(1, imageLayout.dw));
  };

  const publishStroke = () => {
    const canvas = workRef.current;
    const stroke = strokeRef.current;
    if (!canvas || !stroke) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    ctx.putImageData(stroke.img, 0, 0);
    setPaintRev((value) => value + 1);
  };

  const pumpSmart = () => {
    const stroke = strokeRef.current;
    if (!stroke?.seen || !stroke.seedOf) return;
    stroke.head = drainSmart(
      stroke.img,
      stroke.color,
      stroke.seen,
      stroke.seedOf,
      stroke.reaches,
      stroke.queue,
      stroke.head,
      stroke.mode,
      160000,
    );
    publishStroke();
    if (stroke.head < stroke.queue.length) {
      pumpRef.current = requestAnimationFrame(pumpSmart);
    }
  };

  const onPaintDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (hand || boxSelect || !tool || !workCanvas) return;
    const point = imagePoint(event);
    if (!point) return;
    const ctx = workCanvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    let img: ImageData;
    let color: Uint8ClampedArray;
    try {
      img = ctx.getImageData(0, 0, workCanvas.width, workCanvas.height);
      const colors = colorRef.current;
      const colorCtx = colors?.getContext("2d", { willReadFrequently: true });
      color =
        colors && colorCtx && colors.width === workCanvas.width && colors.height === workCanvas.height
          ? colorCtx.getImageData(0, 0, colors.width, colors.height).data
          : img.data;
    } catch {
      return;
    }
    cancelAnimationFrame(pumpRef.current);
    pushUndo();
    paintingRef.current = true;
    const mode = tool === "smart" ? smartMode : brushMode;
    const radius = brushRadius();
    const stroke: PaintStroke = {
      img,
      color,
      seen: tool === "smart" ? new Uint8Array(workCanvas.width * workCanvas.height) : null,
      seedOf: tool === "smart" ? new Int32Array(workCanvas.width * workCanvas.height) : null,
      reaches: [],
      queue: [],
      head: 0,
      mode,
      kind: tool,
      lastX: point.x,
      lastY: point.y,
    };
    if (stroke.kind === "manual") {
      stampInto(stroke.img, point.x, point.y, radius, mode, brushHardness);
    } else if (stroke.seen && stroke.seedOf) {
      seedDisk(stroke.img, stroke.color, stroke.seen, stroke.seedOf, stroke.reaches, stroke.queue, point.x, point.y, radius);
      stroke.head = drainSmart(stroke.img, stroke.color, stroke.seen, stroke.seedOf, stroke.reaches, stroke.queue, 0, mode, 160000);
    }
    strokeRef.current = stroke;
    event.currentTarget.setPointerCapture(event.pointerId);
    publishStroke();
    if (stroke.seen && stroke.head < stroke.queue.length) {
      pumpRef.current = requestAnimationFrame(pumpSmart);
    }
  };

  const onPaintMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    setCursor({ x: event.clientX - bounds.left, y: event.clientY - bounds.top });
    if (!paintingRef.current) return;
    const point = imagePoint(event);
    const stroke = strokeRef.current;
    if (!point || !stroke) return;
    const radius = brushRadius();
    if (stroke.kind === "manual") {
      stampSegment(stroke.img, stroke.lastX, stroke.lastY, point.x, point.y, radius, stroke.mode, brushHardness);
    } else if (stroke.seen && stroke.seedOf) {
      seedDisk(stroke.img, stroke.color, stroke.seen, stroke.seedOf, stroke.reaches, stroke.queue, point.x, point.y, radius);
      stroke.head = drainSmart(
        stroke.img,
        stroke.color,
        stroke.seen,
        stroke.seedOf,
        stroke.reaches,
        stroke.queue,
        stroke.head,
        stroke.mode,
        40000,
      );
    }
    stroke.lastX = point.x;
    stroke.lastY = point.y;
    publishStroke();
    if (stroke.seen && stroke.head < stroke.queue.length) {
      cancelAnimationFrame(pumpRef.current);
      pumpRef.current = requestAnimationFrame(pumpSmart);
    }
  };

  const onPaintUp = () => {
    paintingRef.current = false;
  };

  const onPanDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!hand) return;
    panDragRef.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
    setPanning(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPanMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = panDragRef.current;
    if (!drag) return;
    setPan({ x: drag.panX + event.clientX - drag.x, y: drag.panY + event.clientY - drag.y });
  };

  const onPanUp = () => {
    panDragRef.current = null;
    setPanning(false);
  };

  const showResult = Boolean(showPreview && resultUrl);
  const activeCrop = cropBox && cropBox.w > 0.01 && cropBox.h > 0.01 ? cropBox : null;

  const openTool = (next: "smart" | "manual") => {
    setTool(next);
    setBoxSelect(false);
  };

  const pointInLayer = (event: ReactPointerEvent<HTMLElement>) => {
    const bounds = (layerRef.current ?? event.currentTarget).getBoundingClientRect();
    return {
      x: clamp01((event.clientX - bounds.left) / Math.max(1, bounds.width)),
      y: clamp01((event.clientY - bounds.top) / Math.max(1, bounds.height)),
    };
  };

  const onLayerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    const point = pointInLayer(event);
    dragRef.current = { kind: "new", x0: point.x, y0: point.y };
    setCropBox({ x: point.x, y: point.y, w: 0, h: 0 });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onLayerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const point = pointInLayer(event);
    if (drag.kind === "new") {
      setCropBox(normalizeRect(drag.x0, drag.y0, point.x, point.y));
      return;
    }
    if (drag.kind === "move") {
      const dx = point.x - drag.x0;
      const dy = point.y - drag.y0;
      setCropBox({
        x: Math.max(0, Math.min(1 - drag.box.w, drag.box.x + dx)),
        y: Math.max(0, Math.min(1 - drag.box.h, drag.box.y + dy)),
        w: drag.box.w,
        h: drag.box.h,
      });
      return;
    }
    setCropBox(resizedBox(drag.box, drag.handle, point.x, point.y));
  };

  const onLayerUp = () => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (drag?.kind === "new") {
      setCropBox((box) => (box && (box.w < 0.01 || box.h < 0.01) ? null : box));
    }
  };

  const paintCanvas = () => {
    const color = colorRef.current;
    const mask = workCanvas;
    if (!color || !mask) return null;
    const canvas = document.createElement("canvas");
    canvas.width = color.width;
    canvas.height = color.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(color, 0, 0);
    ctx.globalCompositeOperation = "destination-in";
    ctx.drawImage(mask, 0, 0);
    if (activeCrop && activeCrop.w >= 0.01 && activeCrop.h >= 0.01) {
      ctx.globalCompositeOperation = "destination-in";
      ctx.fillStyle = "#fff";
      ctx.fillRect(
        activeCrop.x * canvas.width,
        activeCrop.y * canvas.height,
        activeCrop.w * canvas.width,
        activeCrop.h * canvas.height,
      );
    }
    return canvas;
  };

  useEffect(() => {
    if (saveRequest > seenSaveRequest.current) {
      seenSaveRequest.current = saveRequest;
      setSaveOpen(true);
    }
  }, [saveRequest]);

  const applyResult = () => {
    const painted = paintCanvas();
    if (painted) {
      onApply(painted.toDataURL("image/png"));
      return;
    }
    if (resultUrl) onApply(resultUrl);
  };

  const downloadPng = () => {
    const painted = paintCanvas();
    if (!painted) {
      void alert({ title: "无法下载 PNG", message: "还没有可保存的抠图。", variant: "error" });
      return;
    }
    painted.toBlob((blob) => {
      if (!blob) {
        void alert({ title: "无法下载 PNG", message: "这张图没能保存成透明 PNG。", variant: "error" });
        return;
      }
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = "抠图.png";
      link.click();
      URL.revokeObjectURL(href);
      setSaveOpen(false);
    }, "image/png");
  };

  const downloadPsd = async () => {
    const color = colorRef.current;
    const mask = workCanvas;
    let width = 0;
    let height = 0;
    let rgba: Uint8ClampedArray | null = null;
    if (color && mask && color.width === mask.width && color.height === mask.height) {
      const colorPx = color.getContext("2d")?.getImageData(0, 0, color.width, color.height).data;
      const maskPx = mask.getContext("2d")?.getImageData(0, 0, mask.width, mask.height).data;
      if (colorPx && maskPx) {
        width = color.width;
        height = color.height;
        rgba = new Uint8ClampedArray(colorPx);
        const x0 = activeCrop ? Math.floor(activeCrop.x * width) : 0;
        const y0 = activeCrop ? Math.floor(activeCrop.y * height) : 0;
        const x1 = activeCrop ? Math.ceil((activeCrop.x + activeCrop.w) * width) : width;
        const y1 = activeCrop ? Math.ceil((activeCrop.y + activeCrop.h) * height) : height;
        const crop = Boolean(activeCrop && activeCrop.w >= 0.01 && activeCrop.h >= 0.01);
        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            const i = (y * width + x) * 4 + 3;
            const inside = !crop || (x >= x0 && x < x1 && y >= y0 && y < y1);
            rgba[i] = inside ? (maskPx[i] ?? 0) : 0;
          }
        }
      }
    }
    if (!rgba && resultUrl) {
      try {
        const img = await loadImage(resultUrl);
        width = img.naturalWidth;
        height = img.naturalHeight;
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          rgba = ctx.getImageData(0, 0, width, height).data;
        }
      } catch {
        rgba = null;
      }
    }
    if (!rgba || width < 1 || height < 1) {
      await alert({ title: "无法生成 PSD", message: "还没有可保存的抠图。", variant: "error" });
      return;
    }
    try {
      const bytes = encodeCutoutPsd({ name: "抠图", width, height, rgba });
      const blob = new Blob([bytes], { type: "image/vnd.adobe.photoshop" });
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = "抠图.psd";
      link.click();
      URL.revokeObjectURL(href);
      setSaveOpen(false);
    } catch {
      await alert({ title: "无法生成 PSD", message: "这张图没能写成 Photoshop 可以打开的文件。", variant: "error" });
    }
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 bg-[var(--ie-cream)]">
      <aside className="flex w-[260px] shrink-0 flex-col border-r border-[var(--ie-border-soft)]">
        <div className="flex items-center justify-between gap-2 px-3 pb-2 pt-3">
          <div className="text-sm font-medium text-[var(--ie-ink)]">自动抠图</div>
          <button
            type="button"
            className="shrink-0 rounded-md border border-[var(--ie-border)] bg-[var(--ie-cream)] px-2 py-1 text-[12px] text-[var(--ie-ink)] hover:bg-[var(--ie-cream-muted)] disabled:opacity-40"
            disabled={running || subject === "off"}
            onClick={() => setRetry((value) => value + 1)}
          >
            重新抠图
          </button>
        </div>
        <div className="relative px-3">
          <button
            type="button"
            aria-expanded={menuOpen}
            aria-label="抠图主体"
            className="flex h-10 w-full items-center gap-2 rounded-lg border border-[var(--ie-border)] bg-[var(--ie-cream)] px-2.5 text-sm text-[var(--ie-ink)]"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <current.icon className="h-4 w-4 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-left">{current.label}</span>
            <ChevronDown className="h-4 w-4 shrink-0 text-[var(--ie-muted)]" aria-hidden />
          </button>
          {menuOpen ? (
            <div className="absolute left-3 right-3 top-12 z-20 overflow-hidden rounded-xl border border-[var(--ie-border-soft)] bg-[var(--ie-cream)] py-1 shadow-lg">
              {SUBJECTS.map((item) => {
                const Icon = item.icon;
                const selected = item.id === subject;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2 text-left text-sm",
                      selected ? "bg-[var(--ie-cream-muted)] text-[var(--ie-ink)]" : "text-[var(--ie-ink)] hover:bg-[var(--ie-cream-deep)]",
                    )}
                    onClick={() => {
                      setSubject(item.id);
                      setMenuOpen(false);
                    }}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="min-w-0 flex-1">{item.label}</span>
                    {selected ? <Check className="h-4 w-4 shrink-0" aria-hidden /> : null}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex-1 space-y-3 overflow-y-auto px-3">
          <p className="text-[12px] font-medium text-[var(--ie-ink)]">选区工具</p>
          <div
            className={cn(
              "rounded-xl border p-3",
              tool === "smart" ? "border-[#3b82f6] bg-white" : "border-transparent bg-[var(--ie-cream-muted)]",
            )}
            onPointerDown={() => openTool("smart")}
          >
            <p className="text-[13px] text-[var(--ie-ink)]">智能选区</p>
            <div className="mt-2 flex items-center gap-2">
              <ModeChoice name="smart" value="remove" current={smartMode} open={tool === "smart"} onChange={(value) => { openTool("smart"); setSmartMode(value); }} />
              <span className="h-3 w-px bg-[var(--ie-border-soft)]" />
              <ModeChoice name="smart" value="keep" current={smartMode} open={tool === "smart"} onChange={(value) => { openTool("smart"); setSmartMode(value); }} />
            </div>
            {tool === "smart" ? (
              <div className="mt-3 border-t border-[var(--ie-border-soft)] pt-3">
                <SliderRow label="画笔大小" value={brushSize} min={1} max={200} onChange={setBrushSize} />
              </div>
            ) : null}
          </div>
          <div
            className={cn(
              "rounded-xl border p-3",
              tool === "manual" ? "border-[#3b82f6] bg-white" : "border-transparent bg-[var(--ie-cream-muted)]",
            )}
            onPointerDown={() => openTool("manual")}
          >
            <p className="text-[13px] text-[var(--ie-ink)]">手动修补</p>
            <div className="mt-2 flex items-center gap-2">
              <ModeChoice name="brush" value="remove" current={brushMode} open={tool === "manual"} onChange={(value) => { openTool("manual"); setBrushMode(value); }} />
              <span className="h-3 w-px bg-[var(--ie-border-soft)]" />
              <ModeChoice name="brush" value="keep" current={brushMode} open={tool === "manual"} onChange={(value) => { openTool("manual"); setBrushMode(value); }} />
            </div>
            {tool === "manual" ? (
              <div className="mt-3 space-y-2 border-t border-[var(--ie-border-soft)] pt-3">
                <SliderRow label="画笔大小" value={brushSize} min={1} max={200} onChange={setBrushSize} />
                <SliderRow label="画笔硬度" value={brushHardness} min={0} max={100} onChange={setBrushHardness} />
              </div>
            ) : null}
          </div>
          <div className="space-y-2">
            <p className="text-[12px] text-[var(--ie-muted)]">局部抠图</p>
            <label className="inline-flex cursor-pointer items-center gap-2 text-[12px] text-[var(--ie-ink)]">
              <input
                type="checkbox"
                className="h-3.5 w-3.5 accent-[var(--ie-ink)]"
                checked={boxSelect}
                onChange={(e) => setBoxSelect(e.target.checked)}
              />
              框选
            </label>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 text-[12px] text-[var(--ie-ink)]">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 accent-[var(--ie-ink)]"
              checked={showPreview}
              onChange={(e) => setShowPreview(e.target.checked)}
            />
            预览抠图
          </label>
        </div>

        <div className="flex gap-2 border-t border-[var(--ie-divider)] p-3">
          <EcomButtonSecondary type="button" size="sm" className="flex-1" onClick={onCancel}>
            取消
          </EcomButtonSecondary>
          <EcomButtonPrimary
            type="button"
            size="sm"
            className="flex-1"
            disabled={!resultUrl || running}
            onClick={() => setSaveOpen(true)}
          >
            确定
          </EcomButtonPrimary>
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-[var(--ie-cream-deep)]">
        {running ? (
          <div className="px-4 pt-3">
            <div className="mb-1 flex items-center justify-between text-[11px] text-[var(--ie-muted)]">
              <span>正在抠图</span>
              <span>{progress}%</span>
            </div>
            <div className="ecom-upload-progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
              <span style={{ width: `${progress}%` }} />
            </div>
          </div>
        ) : error ? (
          <p className="px-4 pt-3 text-[12px] text-[var(--ie-muted)]">{error}</p>
        ) : null}
        <div className="relative min-h-0 flex-1">
          <div className="absolute left-1/2 top-2 z-30 flex -translate-x-1/2 gap-1">
            <button
              type="button"
              aria-label="返回上一步"
              disabled={hist.undo === 0}
              className="grid h-7 w-7 place-items-center rounded-full bg-white text-[var(--ie-ink)] shadow-sm disabled:opacity-40"
              onClick={undo}
            >
              <Undo2 className="h-3.5 w-3.5" aria-hidden />
            </button>
            <button
              type="button"
              aria-label="重做"
              disabled={hist.redo === 0}
              className="grid h-7 w-7 place-items-center rounded-full bg-white text-[var(--ie-ink)] shadow-sm disabled:opacity-40"
              onClick={redo}
            >
              <Redo2 className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
          <div className="grid h-full min-h-0 grid-cols-2 gap-3 p-3 pt-12">
          <figure className="relative h-full min-h-0 overflow-hidden rounded-xl bg-white">
            <CutoutPane
              src={imageUrl}
              selectionSrc={workCanvas ? null : resultUrl}
              maskCanvas={workCanvas}
              maskRev={paintRev}
              zoom={zoom}
              pan={pan}
              alt="原图"
              crop={activeCrop}
              clip={activeCrop ? "selection" : null}
              onLayout={(next) => {
                setImageLayout((prev) => {
                  if (
                    prev &&
                    Math.abs(prev.dx - next.dx) < 0.5 &&
                    Math.abs(prev.dy - next.dy) < 0.5 &&
                    Math.abs(prev.dw - next.dw) < 0.5 &&
                    Math.abs(prev.dh - next.dh) < 0.5
                  ) {
                    return prev;
                  }
                  return next;
                });
              }}
            />
            {workCanvas && tool && !hand && !boxSelect ? (
              <div
                className="absolute inset-0 z-[2] touch-none"
                style={{ cursor: "none" }}
                onPointerDown={onPaintDown}
                onPointerMove={onPaintMove}
                onPointerUp={onPaintUp}
                onPointerLeave={() => {
                  onPaintUp();
                  setCursor(null);
                }}
              />
            ) : null}
            {workCanvas && tool && !hand && !boxSelect && cursor ? (
              <div
                className="pointer-events-none absolute z-[4] rounded-full border border-white shadow-[0_0_0_1px_rgba(0,0,0,0.45)]"
                style={{
                  left: cursor.x,
                  top: cursor.y,
                  width: brushSize,
                  height: brushSize,
                  transform: "translate(-50%, -50%)",
                }}
              />
            ) : null}
            {boxSelect && imageLayout ? (
              <div
                ref={layerRef}
                className="absolute z-[2] touch-none"
                style={{
                  left: imageLayout.dx,
                  top: imageLayout.dy,
                  width: imageLayout.dw,
                  height: imageLayout.dh,
                  cursor: "crosshair",
                }}
                onPointerDown={onLayerDown}
                onPointerMove={onLayerMove}
                onPointerUp={onLayerUp}
              >
                {cropBox && cropBox.w > 0 && cropBox.h > 0 ? (
                  <div
                    className="absolute border-2 border-[#3b82f6]"
                    style={{
                      left: `${cropBox.x * 100}%`,
                      top: `${cropBox.y * 100}%`,
                      width: `${cropBox.w * 100}%`,
                      height: `${cropBox.h * 100}%`,
                      cursor: "move",
                    }}
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      const point = pointInLayer(event);
                      dragRef.current = { kind: "move", x0: point.x, y0: point.y, box: cropBox };
                      layerRef.current?.setPointerCapture(event.pointerId);
                    }}
                  >
                    <Move className="pointer-events-none absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 text-[#3b82f6]" aria-hidden />
                    {BOX_HANDLES.map((handle) => (
                      <button
                        key={handle}
                        type="button"
                        aria-label={`调整框选 ${handle}`}
                        className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 border border-[#3b82f6] bg-white"
                        style={{ ...handleStyle(handle), cursor: handleCursor(handle) }}
                        onPointerDown={(event) => {
                          event.stopPropagation();
                          dragRef.current = { kind: "resize", handle, box: cropBox };
                          layerRef.current?.setPointerCapture(event.pointerId);
                        }}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            <figcaption className="pointer-events-none absolute right-2 top-2 z-[3] rounded-md bg-black/45 px-2 py-0.5 text-[11px] text-white">
              原图
            </figcaption>
          </figure>
          <figure className="relative h-full min-h-0 overflow-hidden rounded-xl bg-white">
            <CutoutPane
              src={imageUrl}
              underlay={showResult ? colorCanvas : null}
              maskCanvas={showResult ? workCanvas : null}
              maskRev={paintRev}
              checker={showResult}
              zoom={zoom}
              pan={pan}
              alt={showResult ? "抠图结果" : "原图"}
              crop={activeCrop}
              clip={activeCrop ? "image" : null}
            />
            <figcaption className="pointer-events-none absolute right-2 top-2 z-[3] rounded-md bg-black/45 px-2 py-0.5 text-[11px] text-white">
              预览
            </figcaption>
          </figure>
          </div>
          {hand ? (
            <div
              className="absolute inset-0 z-20 touch-none"
              style={{ cursor: panning ? "grabbing" : "grab" }}
              onPointerDown={onPanDown}
              onPointerMove={onPanMove}
              onPointerUp={onPanUp}
              onPointerCancel={onPanUp}
            />
          ) : null}
        </div>
        <div className="flex justify-center pb-3">
          <div className="inline-flex h-8 items-center rounded-lg border border-[var(--ie-border-soft)] bg-[var(--ie-cream)] text-[11px] text-[var(--ie-ink)] shadow-sm">
            <button
              type="button"
              aria-label="移动画布"
              aria-pressed={hand}
              className={cn("inline-flex h-8 w-8 items-center justify-center", hand && "text-[#0071e3]")}
              onClick={() => setHand((value) => !value)}
            >
              <Hand className="h-3.5 w-3.5" aria-hidden />
            </button>
            <button type="button" aria-label="缩小" className="inline-flex h-8 w-7 items-center justify-center" onClick={() => setZoom((value) => Math.max(25, value - 10))}>
              <Minus className="h-3.5 w-3.5" aria-hidden />
            </button>
            <span className="min-w-10 px-1 text-center">{zoom}%</span>
            <button type="button" aria-label="放大" className="inline-flex h-8 w-7 items-center justify-center" onClick={() => setZoom((value) => Math.min(200, value + 10))}>
              <Plus className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        </div>
      </div>
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="max-w-sm bg-[var(--ie-cream)]">
          <DialogHeader>
            <DialogTitle>保存抠图</DialogTitle>
            <DialogDescription>
              可以合并成一张图片放回画布，也可以下载透明背景的 PNG，或带透明图层的 PSD。PNG 按当前抠图效果保存，透明的地方保持透明。下载后画布保持不动。
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <EcomButtonPrimary
              type="button"
              disabled={!resultUrl || running}
              onClick={() => {
                setSaveOpen(false);
                applyResult();
              }}
            >
              合并为一张图片
            </EcomButtonPrimary>
            <EcomButtonSecondary type="button" disabled={!resultUrl || running} onClick={downloadPng}>
              下载 PNG
            </EcomButtonSecondary>
            <EcomButtonSecondary type="button" disabled={!resultUrl || running} onClick={() => { void downloadPsd(); }}>
              生成 PSD
            </EcomButtonSecondary>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
