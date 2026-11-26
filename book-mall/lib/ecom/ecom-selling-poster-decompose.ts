/**
 * 商品卖点贴纸拆层。
 * 编号清单和已拆内容放在进程内存；库只在冷启动、第一次拆完、以及内存里还没有这份内容时读。
 * 同一张贴纸同时点取消组合，只打一次 Seedream。
 */
import sharp from "sharp";

import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";
import {
  decomposeImageLayer,
  ECOM_IMAGE_LAYER_MODEL_55,
  type ImageLayerStackItem,
} from "@/lib/ecom/ecom-image-layer-service";
import { prisma } from "@/lib/prisma";

export const SELLING_DECOMPOSE_PROMPT =
  "将图片进行精确图层分离。按图里实际有的元素拆开，没有的不要造：背景单独一层。每个色块单独一层，保持原形状（圆角方、胶囊、圆、圆环、描边框、箭头、花边、下划条），描边和投影跟色块留在一起。每个标记单独一层（勾、圆点、圆环、星、编号），不要画进色块。每一行文字单独一层，图层名称写成这一行的文字内容。";

const PENDING_MS = 8 * 60 * 1000;

export type SellingDecomposeRole = "background" | "block" | "mark" | "text";

export type SellingDecomposeLayer = {
  role: SellingDecomposeRole;
  url: string;
  name: string;
  text: string;
  /** 文字图层从图里取到的颜色。没有时前端再用深色。 */
  color?: string;
  /** 描边层已经抠掉中间的填充。 */
  punched?: boolean;
  z: number;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type SellingDecomposePack = {
  imgW: number;
  imgH: number;
  layers: SellingDecomposeLayer[];
};

type IndexCache = { rev: string; ids: string[] };

let indexCache: IndexCache | null = null;
const packCache = new Map<string, SellingDecomposePack>();
const jobs = new Map<string, Promise<void>>();
const failReason = new Map<string, string>();

export function isSellingPosterId(raw: string): boolean {
  return /^[0-9]{10}$/.test(raw);
}

export function pngSize(buf: Buffer): { w: number; h: number } | null {
  if (buf.length < 24) return null;
  if (buf[0] !== 0x89 || buf.toString("ascii", 1, 4) !== "PNG") return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

function asPack(raw: unknown): SellingDecomposePack | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const imgW = typeof row.imgW === "number" ? row.imgW : 0;
  const imgH = typeof row.imgH === "number" ? row.imgH : 0;
  if (!Array.isArray(row.layers) || imgW < 2 || imgH < 2) return null;
  const layers: SellingDecomposeLayer[] = [];
  for (const item of row.layers) {
    if (!item || typeof item !== "object") continue;
    const layer = item as Record<string, unknown>;
    const role = layer.role;
    const url = typeof layer.url === "string" ? layer.url : "";
    if (role !== "background" && role !== "block" && role !== "mark" && role !== "text") continue;
    if (!url && role !== "mark" && role !== "text") continue;
    layers.push({
      role,
      url,
      name: typeof layer.name === "string" ? layer.name : "",
      text: typeof layer.text === "string" ? layer.text : "",
      ...(typeof layer.color === "string" && /^#[0-9a-fA-F]{6}$/.test(layer.color) ? { color: layer.color } : {}),
      ...(layer.punched === true ? { punched: true } : {}),
      z: typeof layer.z === "number" ? layer.z : 0,
      x: typeof layer.x === "number" ? layer.x : 0,
      y: typeof layer.y === "number" ? layer.y : 0,
      w: typeof layer.w === "number" ? layer.w : 1,
      h: typeof layer.h === "number" ? layer.h : 1,
    });
  }
  if (!layers.length) return null;
  return normalizePack({ imgW, imgH, layers });
}

async function loadIndex(): Promise<IndexCache> {
  if (indexCache) return indexCache;
  const rows = await prisma.imageEditorPosterDecompose.findMany({
    where: { status: "ready" },
    select: { posterId: true, updatedAt: true },
  });
  const rev = rows.reduce((max, row) => Math.max(max, row.updatedAt.getTime()), 0).toString();
  indexCache = { rev, ids: rows.map((row) => row.posterId) };
  return indexCache;
}

function rememberReady(posterId: string, pack: SellingDecomposePack) {
  pack = normalizePack(pack);
  packCache.set(posterId, pack);
  if (!indexCache) {
    indexCache = { rev: Date.now().toString(), ids: [posterId] };
    return;
  }
  if (!indexCache.ids.includes(posterId)) indexCache.ids.push(posterId);
  indexCache.rev = Date.now().toString();
}

export async function readSellingDecomposeIndex(ifNoneMatch?: string | null): Promise<
  { notModified: true; rev: string } | { notModified: false; rev: string; ids: string[] }
> {
  const index = await loadIndex();
  const tag = ifNoneMatch?.trim().replace(/^W\//, "").replaceAll('"', "");
  if (tag && tag === index.rev) return { notModified: true, rev: index.rev };
  return { notModified: false, rev: index.rev, ids: index.ids };
}

function needsGlyphColor(pack: SellingDecomposePack): boolean {
  return pack.layers.some((layer) => layer.role === "text" && layer.url && !layer.color);
}

function needsStrokePunch(pack: SellingDecomposePack): boolean {
  return pack.layers.some((layer) => layer.role === "block" && /描边|边框/.test(layer.name) && !layer.punched);
}

function packReady(pack: SellingDecomposePack): boolean {
  return !needsCheckSplit(pack) && !needsGlyphColor(pack) && !needsStrokePunch(pack);
}

export async function readSellingDecomposePack(posterId: string): Promise<SellingDecomposePack | null> {
  const cached = packCache.get(posterId);
  if (cached && packReady(cached)) return normalizePack(cached);
  const row = await prisma.imageEditorPosterDecompose.findUnique({ where: { posterId } });
  if (row?.status !== "ready") return null;
  const pack = asPack(row.pack);
  if (!pack) return null;
  return presentPack(posterId, pack);
}

export type SellingDecomposeProbe =
  | { status: "ready"; pack: SellingDecomposePack }
  | { status: "pending" }
  | { status: "missing" }
  | { status: "failed"; error: string };

export async function probeSellingDecompose(posterId: string): Promise<SellingDecomposeProbe> {
  const cached = packCache.get(posterId);
  if (cached && packReady(cached)) {
    const pack = normalizePack(cached);
    packCache.set(posterId, pack);
    return { status: "ready", pack };
  }
  const row = await prisma.imageEditorPosterDecompose.findUnique({ where: { posterId } });
  if (!row) {
    const error = failReason.get(posterId);
    if (error) return { status: "failed", error };
    return { status: "missing" };
  }
  if (row.status === "ready") {
    const pack = asPack(row.pack);
    if (pack) return { status: "ready", pack: await presentPack(posterId, pack) };
  }
  if (row.status === "pending" && Date.now() - row.updatedAt.getTime() < PENDING_MS) {
    return { status: "pending" };
  }
  return { status: "missing" };
}

function markText(name: string): string {
  if (/圆点|圆圈/.test(name)) return "●";
  if (/星/.test(name)) return "★";
  const num = name.match(/\d+/);
  if (/编号|数字/.test(name)) return num?.[0] ?? "1";
  return "✓";
}

/**
 * 图层名里的中文经常是说明（「红色圆角对勾图标」「白色背景」），不是画面上的字。
 * 说明对应图片；只有短的正文（「商品卖点」）才变成可编辑文字。
 */
function classifySellingLayer(
  name: string,
  fallback: SellingDecomposeRole,
): { role: SellingDecomposeRole; text: string } {
  const trimmed = name.trim();
  if (!trimmed) {
    if (fallback === "text" || fallback === "mark") return { role: "block", text: "" };
    return { role: fallback, text: "" };
  }
  if (/背景/.test(trimmed)) return { role: "background", text: "" };
  if (/标记|图标|色块|环形|圆环|描边|胶囊|圆角|形状|底板|边框|图层|元素|装饰|贴纸|方块|底色/.test(trimmed)) {
    return { role: "block", text: "" };
  }
  if (/圆环|空心圆/.test(trimmed) && !/勾|对号|对勾/.test(trimmed)) return { role: "mark", text: "○" };
  if (/勾|对号|对勾|标记|圆点|星|编号/.test(trimmed) && trimmed.length <= 8) {
    return { role: "mark", text: markText(trimmed) };
  }
  if (trimmed.length <= 16 && /[\u4e00-\u9fffA-Za-z0-9]/.test(trimmed) && !/图层|元素|分离|拆分/.test(trimmed)) {
    return { role: "text", text: trimmed };
  }
  return { role: "block", text: "" };
}

function normalizePack(pack: SellingDecomposePack): SellingDecomposePack {
  const classified = pack.layers.map((layer) => {
    const next = classifySellingLayer(layer.name, layer.role);
    return { ...layer, role: next.role, text: next.text };
  });
  const hasNamedBackground = classified.some((layer) => layer.name.trim() && layer.role === "background");
  const layers = classified.filter((layer) => {
    if (hasNamedBackground && !layer.name.trim() && layer.role === "background" && layer.h < 0.3) return false;
    return true;
  });
  return { ...pack, layers };
}

function combinedCheckIcon(layer: SellingDecomposeLayer): boolean {
  return layer.role === "block" && /勾/.test(layer.name) && /图标|色块|圆角|方/.test(layer.name);
}

function needsCheckSplit(pack: SellingDecomposePack): boolean {
  return pack.layers.some(combinedCheckIcon);
}

/** 用色块本身的颜色填满内部，勾不再留在图里。 */
export async function removeCheckFromBlockPng(buf: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixels = Buffer.from(data);
  const width = info.width;
  const height = info.height;
  const samples: number[] = [];
  for (let y = 0; y < height; y++) {
    const opaque: number[] = [];
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if ((pixels[i + 3] ?? 0) < 250) continue;
      const r = pixels[i] ?? 0;
      const g = pixels[i + 1] ?? 0;
      const b = pixels[i + 2] ?? 0;
      const lum = (r + g + b) / 3;
      const sat = Math.max(r, g, b) - Math.min(r, g, b);
      if (lum > 170 && sat < 55) continue;
      opaque.push(i);
    }
    if (opaque.length < 4) continue;
    samples.push(opaque[Math.min(opaque.length - 1, 6)] ?? opaque[0]!);
  }
  if (samples.length < 4) return buf;
  const pick = samples.map((i) => (pixels[i] ?? 0) * 65536 + (pixels[i + 1] ?? 0) * 256 + (pixels[i + 2] ?? 0));
  pick.sort((a, b) => a - b);
  const mid = pick[Math.floor(pick.length / 2)] ?? 0;
  const cr = (mid >> 16) & 255;
  const cg = (mid >> 8) & 255;
  const cb = mid & 255;
  let painted = 0;
  for (let p = 0; p < width * height; p++) {
    const i = p * 4;
    if ((pixels[i + 3] ?? 0) < 250) continue;
    pixels[i] = cr;
    pixels[i + 1] = cg;
    pixels[i + 2] = cb;
    painted += 1;
  }
  if (painted < 8) return buf;
  return sharp(pixels, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

async function liftChecks(pack: SellingDecomposePack, posterId: string): Promise<SellingDecomposePack> {
  const layers: SellingDecomposeLayer[] = [];
  for (const layer of pack.layers) {
    if (!combinedCheckIcon(layer)) {
      layers.push(layer);
      continue;
    }
    try {
      const res = await fetch(layer.url);
      if (!res.ok) throw new Error(`色块图读取失败 ${res.status}`);
      const cleaned = await removeCheckFromBlockPng(Buffer.from(await res.arrayBuffer()));
      const url = await uploadCanvasUserBuffer({
        userId: `poster-${posterId}`,
        buf: cleaned,
        contentType: "image/png",
        ext: "png",
      });
      layers.push({ ...layer, url, name: layer.name.replace(/对勾|勾/g, "") || "色块" });
      layers.push({
        role: "mark",
        url: "",
        name: "勾",
        text: "✓",
        z: layer.z + 0.5,
        x: layer.x,
        y: layer.y,
        w: layer.w,
        h: layer.h,
      });
    } catch (e) {
      console.error("[selling-decompose] split check failed", posterId, e);
      layers.push(layer);
    }
  }
  return normalizePack({ ...pack, layers });
}

/** 从文字图里取字的颜色。黑底上的浅字取浅色，透明底上的深字取深色。 */
export async function sampleGlyphColor(buf: Buffer): Promise<string | null> {
  const { data } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let lightR = 0;
  let lightG = 0;
  let lightB = 0;
  let lightN = 0;
  let darkR = 0;
  let darkG = 0;
  let darkB = 0;
  let darkN = 0;
  for (let i = 0; i < data.length; i += 4) {
    if ((data[i + 3] ?? 0) < 200) continue;
    const r = data[i] ?? 0;
    const g = data[i + 1] ?? 0;
    const b = data[i + 2] ?? 0;
    const lum = (r * 3 + g * 6 + b) / 10;
    if (lum > 245) continue;
    if (lum >= 140) {
      lightR += r;
      lightG += g;
      lightB += b;
      lightN += 1;
    } else {
      darkR += r;
      darkG += g;
      darkB += b;
      darkN += 1;
    }
  }
  const darkLum = darkN ? (darkR * 3 + darkG * 6 + darkB) / 10 / darkN : 255;
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  if (lightN > 8 && darkN > lightN * 3 && darkLum < 40) {
    r = lightR;
    g = lightG;
    b = lightB;
    n = lightN;
  } else if (darkN > 8 && lightN === 0) {
    r = darkR;
    g = darkG;
    b = darkB;
    n = darkN;
  } else if (lightN >= darkN && lightN > 8) {
    r = lightR;
    g = lightG;
    b = lightB;
    n = lightN;
  } else if (darkN > 8) {
    r = darkR;
    g = darkG;
    b = darkB;
    n = darkN;
  } else {
    return null;
  }
  const hex = (value: number) => Math.round(value / n).toString(16).padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

async function paintGlyphColors(pack: SellingDecomposePack): Promise<SellingDecomposePack> {
  let changed = false;
  const layers: SellingDecomposeLayer[] = [];
  for (const layer of pack.layers) {
    if ((layer.role !== "text" && layer.role !== "mark") || !layer.url || layer.color) {
      layers.push(layer);
      continue;
    }
    try {
      const res = await fetch(layer.url);
      if (!res.ok) throw new Error(String(res.status));
      const color = await sampleGlyphColor(Buffer.from(await res.arrayBuffer()));
      if (!color) {
        layers.push(layer);
        continue;
      }
      changed = true;
      layers.push({ ...layer, color });
    } catch (error) {
      console.error("[selling-decompose] glyph color", error);
      layers.push(layer);
    }
  }
  return changed ? { ...pack, layers } : pack;
}

/** 描边图中间如果被铺成一片灰，抠掉这层填充，只留边线。 */
export async function removeStrokeFillPng(buf: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixels = Buffer.from(data);
  const bins = new Map<number, { n: number; r: number; g: number; b: number }>();
  let opaque = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    if ((pixels[i + 3] ?? 0) < 200) continue;
    opaque += 1;
    const key = ((pixels[i] ?? 0) >> 3) << 16 | ((pixels[i + 1] ?? 0) >> 3) << 8 | ((pixels[i + 2] ?? 0) >> 3);
    const bin = bins.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    bin.n += 1;
    bin.r += pixels[i] ?? 0;
    bin.g += pixels[i + 1] ?? 0;
    bin.b += pixels[i + 2] ?? 0;
    bins.set(key, bin);
  }
  let top: { n: number; r: number; g: number; b: number } | null = null;
  for (const bin of bins.values()) if (!top || bin.n > top.n) top = bin;
  if (!top || opaque < 32 || top.n / opaque < 0.55) return buf;
  const cr = Math.round(top.r / top.n);
  const cg = Math.round(top.g / top.n);
  const cb = Math.round(top.b / top.n);
  let kept = 0;
  let cleared = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    if ((pixels[i + 3] ?? 0) < 200) continue;
    const dist = Math.abs((pixels[i] ?? 0) - cr) + Math.abs((pixels[i + 1] ?? 0) - cg) + Math.abs((pixels[i + 2] ?? 0) - cb);
    if (dist < 80) {
      pixels[i + 3] = 0;
      cleared += 1;
    } else {
      kept += 1;
    }
  }
  if (kept < opaque * 0.02 || cleared < opaque * 0.4) return buf;
  return sharp(pixels, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

async function punchStrokes(pack: SellingDecomposePack, posterId: string): Promise<SellingDecomposePack> {
  const layers: SellingDecomposeLayer[] = [];
  for (const layer of pack.layers) {
    if (layer.role !== "block" || !/描边|边框/.test(layer.name) || layer.punched || !layer.url) {
      layers.push(layer);
      continue;
    }
    try {
      const res = await fetch(layer.url);
      if (!res.ok) throw new Error(String(res.status));
      const opened = await removeStrokeFillPng(Buffer.from(await res.arrayBuffer()));
      const url = await uploadCanvasUserBuffer({
        userId: `poster-${posterId}`,
        buf: opened,
        contentType: "image/png",
        ext: "png",
      });
      layers.push({ ...layer, url, punched: true });
    } catch (error) {
      console.error("[selling-decompose] punch stroke", posterId, error);
      layers.push({ ...layer, punched: true });
    }
  }
  return { ...pack, layers };
}

const splitJobs = new Map<string, Promise<SellingDecomposePack>>();

async function presentPack(posterId: string, pack: SellingDecomposePack): Promise<SellingDecomposePack> {
  const normalized = normalizePack(pack);
  if (!needsCheckSplit(normalized) && !needsGlyphColor(normalized) && !needsStrokePunch(normalized)) {
    rememberReady(posterId, normalized);
    return normalized;
  }
  const pending = splitJobs.get(posterId);
  if (pending) return pending;
  const task = (async () => {
    let next = normalized;
    let dirty = false;
    if (needsCheckSplit(next)) {
      next = await liftChecks(next, posterId);
      dirty = true;
    }
    if (needsGlyphColor(next)) {
      const painted = await paintGlyphColors(next);
      if (painted !== next) {
        next = painted;
        dirty = true;
      }
    }
    if (needsStrokePunch(next)) {
      next = await punchStrokes(next, posterId);
      dirty = true;
    }
    if (dirty) {
      await prisma.imageEditorPosterDecompose.update({
        where: { posterId },
        data: { pack: next },
      }).catch(() => undefined);
    }
    rememberReady(posterId, next);
    return next;
  })().finally(() => {
    splitJobs.delete(posterId);
  });
  splitJobs.set(posterId, task);
  return task;
}

type ContentFrame = { x: number; y: number; w: number; h: number };

/**
 * 卖点原图常常又小又贴边，图层拆分会直接拒绝。
 * 先放大，再在四周留白，画布短边至少 768。位置以后按这块内容区换算回原图。
 */
async function prepareSellingDecomposePng(buf: Buffer): Promise<{ png: Buffer; frame: ContentFrame }> {
  const meta = await sharp(buf, { failOn: "none" }).rotate().metadata();
  const srcW = meta.width ?? 1;
  const srcH = meta.height ?? 1;
  const scale = Math.max(1, 640 / Math.min(srcW, srcH));
  let contentW = Math.max(1, Math.round(srcW * scale));
  let contentH = Math.max(1, Math.round(srcH * scale));
  let padX = Math.round(contentW * 0.12);
  let padY = Math.round(contentH * 0.12);
  let canvasW = contentW + padX * 2;
  let canvasH = contentH + padY * 2;
  if (Math.min(canvasW, canvasH) < 768) {
    if (canvasW <= canvasH) {
      const extra = 768 - canvasW;
      padX += Math.ceil(extra / 2);
    } else {
      const extra = 768 - canvasH;
      padY += Math.ceil(extra / 2);
    }
    canvasW = contentW + padX * 2;
    canvasH = contentH + padY * 2;
  }
  const maxPixels = 4_000_000;
  if (canvasW * canvasH > maxPixels) {
    const fit = Math.sqrt(maxPixels / (canvasW * canvasH));
    contentW = Math.max(1, Math.round(contentW * fit));
    contentH = Math.max(1, Math.round(contentH * fit));
    padX = Math.max(8, Math.round(padX * fit));
    padY = Math.max(8, Math.round(padY * fit));
    canvasW = contentW + padX * 2;
    canvasH = contentH + padY * 2;
  }
  const artwork = await sharp(buf, { failOn: "none" })
    .rotate()
    .flatten({ background: "#ffffff" })
    .resize(contentW, contentH, { fit: "fill" })
    .png()
    .toBuffer();
  const png = await sharp({
    create: { width: canvasW, height: canvasH, channels: 3, background: "#ffffff" },
  })
    .composite([{ input: artwork, left: padX, top: padY }])
    .png()
    .toBuffer();
  return {
    png,
    frame: { x: padX / canvasW, y: padY / canvasH, w: contentW / canvasW, h: contentH / canvasH },
  };
}

function remapBox(
  box: { x: number; y: number; w: number; h: number },
  frame: ContentFrame,
): { x: number; y: number; w: number; h: number } | null {
  const coversCanvas = box.w > 0.9 && box.h > 0.9;
  const inset = frame.w < 0.92 || frame.h < 0.92;
  if (coversCanvas && inset) return null;
  const x1 = (box.x - frame.x) / frame.w;
  const y1 = (box.y - frame.y) / frame.h;
  const x2 = (box.x + box.w - frame.x) / frame.w;
  const y2 = (box.y + box.h - frame.y) / frame.h;
  const left = Math.min(1, Math.max(0, Math.min(x1, x2)));
  const top = Math.min(1, Math.max(0, Math.min(y1, y2)));
  const right = Math.min(1, Math.max(0, Math.max(x1, x2)));
  const bottom = Math.min(1, Math.max(0, Math.max(y1, y2)));
  const w = right - left;
  const h = bottom - top;
  if (w < 0.02 || h < 0.02) return null;
  return { x: left, y: top, w, h };
}

function boxOf(layer: ImageLayerStackItem, index: number, count: number): { x: number; y: number; w: number; h: number } {
  const n = layer.bbox?.normalized;
  if (n && n.length >= 4) {
    const x1 = Math.min(n[0], n[2]) / 999;
    const y1 = Math.min(n[1], n[3]) / 999;
    const x2 = Math.max(n[0], n[2]) / 999;
    const y2 = Math.max(n[1], n[3]) / 999;
    return {
      x: x1,
      y: y1,
      w: Math.max(0.02, x2 - x1),
      h: Math.max(0.02, y2 - y1),
    };
  }
  const h = 1 / Math.max(1, count);
  return { x: 0, y: index * h, w: 1, h };
}

function toPack(
  imgW: number,
  imgH: number,
  items: ImageLayerStackItem[],
  frame?: ContentFrame,
): SellingDecomposePack {
  const ordered = [...items].sort((a, b) => a.zIndex - b.zIndex);
  const layers = ordered.flatMap((layer, index) => {
    const name = layer.name?.trim() ?? "";
    const role = classifySellingLayer(name, layer.isBackground ? "background" : "block");
    const raw = boxOf(layer, index, ordered.length);
    const box = frame ? remapBox(raw, frame) : raw;
    if (!box) return [];
    return [
      {
        role: role.role,
        url: layer.url,
        name,
        text: role.text,
        z: layer.zIndex,
        ...box,
      },
    ];
  });
  return normalizePack({ imgW, imgH, layers });
}

type LocalPiece = {
  role: SellingDecomposeRole;
  name: string;
  text: string;
  color?: string;
  png?: Buffer;
  z: number;
  x: number;
  y: number;
  w: number;
  h: number;
};

function hexByte(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
}

/**
 * 模型拒收又小又贴边的贴纸时，按透明底和中间空隙拆开：
 * 色块留下形状，勾改成可编辑的 ✓，文字仍用原图上的字形。
 */
export async function buildLocalSellingPieces(
  buf: Buffer,
): Promise<{ imgW: number; imgH: number; pieces: LocalPiece[] } | null> {
  const { data, info } = await sharp(buf, { failOn: "none" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const width = info.width ?? 0;
  const height = info.height ?? 0;
  if (width < 8 || height < 8) return null;
  const pixels = data;
  const cols = new Int32Array(width);
  let minX = width;
  let maxX = -1;
  let minY = height;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if ((pixels[(y * width + x) * 4 + 3] ?? 0) < 20) continue;
      cols[x] += 1;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX <= minX) return null;
  let gapStart = -1;
  let best = { x: 0, len: 0 };
  for (let x = minX; x <= maxX; x += 1) {
    if (cols[x] === 0) {
      if (gapStart < 0) gapStart = x;
    } else if (gapStart >= 0) {
      const len = x - gapStart;
      if (len > best.len) best = { x: gapStart, len };
      gapStart = -1;
    }
  }
  if (best.len < 4 || best.x <= minX + 4 || best.x + best.len >= maxX - 4) return null;

  const bounds = (x0: number, x1: number, pred?: (byte: number) => boolean) => {
    let left = width;
    let right = -1;
    let top = height;
    let bottom = -1;
    let n = 0;
    for (let y = 0; y < height; y += 1) {
      for (let x = x0; x < x1; x += 1) {
        const byte = (y * width + x) * 4;
        if ((pixels[byte + 3] ?? 0) < 20) continue;
        if (pred && !pred(byte)) continue;
        n += 1;
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
    if (n < 8 || right < left) return null;
    return { x: left, y: top, w: right - left + 1, h: bottom - top + 1 };
  };

  const isCheck = (byte: number) => {
    const r = pixels[byte] ?? 0;
    const g = pixels[byte + 1] ?? 0;
    const b = pixels[byte + 2] ?? 0;
    return b > r + 25 && b > g + 8 && b > 90;
  };

  const icon = bounds(minX, best.x);
  const text = bounds(best.x + best.len, maxX + 1);
  if (!icon || !text) return null;

  const checkMask = new Uint8Array(width * height);
  let cr = 0;
  let cg = 0;
  let cb = 0;
  let cn = 0;
  for (let y = icon.y; y < icon.y + icon.h; y += 1) {
    for (let x = icon.x; x < icon.x + icon.w; x += 1) {
      const byte = (y * width + x) * 4;
      if ((pixels[byte + 3] ?? 0) < 20 || !isCheck(byte)) continue;
      checkMask[y * width + x] = 1;
      cr += pixels[byte] ?? 0;
      cg += pixels[byte + 1] ?? 0;
      cb += pixels[byte + 2] ?? 0;
      cn += 1;
    }
  }
  if (cn >= 12) {
    const grown = new Uint8Array(checkMask);
    for (let y = icon.y; y < icon.y + icon.h; y += 1) {
      for (let x = icon.x; x < icon.x + icon.w; x += 1) {
        if (checkMask[y * width + x]) {
          grown[y * width + x] = 1;
          continue;
        }
        let near = false;
        for (let dy = -1; dy <= 1 && !near; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            const xx = x + dx;
            const yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue;
            if (checkMask[yy * width + xx]) {
              near = true;
              break;
            }
          }
        }
        if (!near) continue;
        const byte = (y * width + x) * 4;
        const lum = ((pixels[byte] ?? 0) + (pixels[byte + 1] ?? 0) + (pixels[byte + 2] ?? 0)) / 3;
        if (lum > 110) grown[y * width + x] = 1;
      }
    }
    checkMask.set(grown);
  }

  let yr = 0;
  let yg = 0;
  let yb = 0;
  let yn = 0;
  for (let y = icon.y; y < icon.y + icon.h; y += 1) {
    for (let x = icon.x; x < icon.x + icon.w; x += 1) {
      const byte = (y * width + x) * 4;
      if ((pixels[byte + 3] ?? 0) < 200 || checkMask[y * width + x]) continue;
      const r = pixels[byte] ?? 0;
      const g = pixels[byte + 1] ?? 0;
      const b = pixels[byte + 2] ?? 0;
      if (!(r > 180 && g > 160 && b < 170 && r > b + 40)) continue;
      yr += r;
      yg += g;
      yb += b;
      yn += 1;
    }
  }
  const fillR = yn ? Math.round(yr / yn) : 255;
  const fillG = yn ? Math.round(yg / yn) : 220;
  const fillB = yn ? Math.round(yb / yn) : 60;

  const crop = async (box: { x: number; y: number; w: number; h: number }, paintCheck: boolean) => {
    const out = Buffer.alloc(box.w * box.h * 4);
    for (let y = 0; y < box.h; y += 1) {
      for (let x = 0; x < box.w; x += 1) {
        const sx = box.x + x;
        const sy = box.y + y;
        const si = (sy * width + sx) * 4;
        const di = (y * box.w + x) * 4;
        if (paintCheck && checkMask[sy * width + sx]) {
          out[di] = fillR;
          out[di + 1] = fillG;
          out[di + 2] = fillB;
          out[di + 3] = 255;
          continue;
        }
        out[di] = pixels[si] ?? 0;
        out[di + 1] = pixels[si + 1] ?? 0;
        out[di + 2] = pixels[si + 2] ?? 0;
        out[di + 3] = pixels[si + 3] ?? 0;
      }
    }
    return sharp(out, { raw: { width: box.w, height: box.h, channels: 4 } }).png().toBuffer();
  };

  const boxOf = (box: { x: number; y: number; w: number; h: number }) => ({
    x: box.x / width,
    y: box.y / height,
    w: box.w / width,
    h: box.h / height,
  });
  const pieces: LocalPiece[] = [
    {
      role: "block",
      name: "色块",
      text: "",
      png: await crop(icon, cn >= 12),
      z: 1,
      ...boxOf(icon),
    },
    {
      role: "block",
      name: "文字图层",
      text: "",
      png: await crop(text, false),
      z: 2,
      ...boxOf(text),
    },
  ];
  if (cn >= 12) {
    const checkBox = bounds(icon.x, icon.x + icon.w, isCheck);
    if (checkBox) {
      pieces.push({
        role: "mark",
        name: "勾",
        text: "✓",
        color: `#${hexByte(cr / cn)}${hexByte(cg / cn)}${hexByte(cb / cn)}`,
        z: 3,
        ...boxOf(checkBox),
      });
    }
  }
  return { imgW: width, imgH: height, pieces };
}

function vendorRefusedLayerSplit(message: string): boolean {
  return /原图无法用于图层拆分|image content could not be processed for layer decomposition/i.test(message);
}

async function packFromLocalPieces(posterId: string, file: Buffer): Promise<SellingDecomposePack | null> {
  const built = await buildLocalSellingPieces(file);
  if (!built || built.pieces.length < 2) return null;
  const layers: SellingDecomposeLayer[] = [];
  for (const piece of built.pieces) {
    const url = piece.png
      ? await uploadCanvasUserBuffer({
          userId: `poster-${posterId}`,
          buf: piece.png,
          contentType: "image/png",
          ext: "png",
        })
      : "";
    layers.push({
      role: piece.role,
      url,
      name: piece.name,
      text: piece.text,
      ...(piece.color ? { color: piece.color } : {}),
      z: piece.z,
      x: piece.x,
      y: piece.y,
      w: piece.w,
      h: piece.h,
    });
  }
  return normalizePack({ imgW: built.imgW, imgH: built.imgH, layers });
}

async function claimPending(posterId: string): Promise<"ready" | "pending" | "claimed" | "local"> {
  const row = await prisma.imageEditorPosterDecompose.findUnique({ where: { posterId } });
  if (row?.status === "ready" && asPack(row.pack)) return "ready";
  if (row?.status === "pending" && Date.now() - row.updatedAt.getTime() < PENDING_MS) return "pending";
  const localOnly = row?.status === "refused";
  if (row) {
    await prisma.imageEditorPosterDecompose.delete({ where: { posterId } }).catch(() => undefined);
  }
  try {
    await prisma.imageEditorPosterDecompose.create({
      data: { posterId, status: "pending" },
    });
    failReason.delete(posterId);
    return localOnly ? "local" : "claimed";
  } catch {
    return "pending";
  }
}

function startJob(posterId: string, userId: string, file: Buffer, imgW: number, imgH: number, localOnly = false) {
  if (jobs.has(posterId)) return;
  const task = (async () => {
    const saveReady = async (pack: SellingDecomposePack) => {
      await prisma.imageEditorPosterDecompose.update({
        where: { posterId },
        data: { status: "ready", pack },
      });
    };
    try {
      if (!localOnly) {
        try {
          const framed = await prepareSellingDecomposePng(file);
          const sourceImageUrl = await uploadCanvasUserBuffer({
            userId,
            buf: framed.png,
            contentType: "image/png",
            ext: "png",
          });
          const stack = await decomposeImageLayer({
            userId,
            sourceImageUrl,
            prompt: SELLING_DECOMPOSE_PROMPT,
            clientPage: "ecom/image-editor/selling-decompose",
            modelKey: "doubao-seedream-5-0-pro",
            size: "auto",
          });
          const items = [stack.background, ...stack.layers];
          await saveReady(await presentPack(posterId, toPack(imgW, imgH, items, framed.frame)));
          return;
        } catch (e) {
          const message = e instanceof Error ? e.message : "";
          if (!vendorRefusedLayerSplit(message)) throw e;
        }
      }
      const local = await packFromLocalPieces(posterId, file);
      if (!local) {
        throw new Error("原图无法用于图层拆分。请使用清晰的 PNG/JPEG（边长与总像素在官方限制内，宽高比不超过 16:1），或换一张图后重试。");
      }
      await saveReady(await presentPack(posterId, local));
    } catch (e) {
      const message = e instanceof Error ? e.message : "拆分失败";
      console.error("[selling-decompose]", posterId, e);
      failReason.set(posterId, message);
      await prisma.imageEditorPosterDecompose.delete({ where: { posterId } }).catch(() => undefined);
    }
  })().finally(() => {
    jobs.delete(posterId);
  });
  jobs.set(posterId, task);
  void task.catch(() => undefined);
}

/** 没有文件时只查缓存。有文件且库里没有，才开始拆。 */
export async function beginSellingDecompose(opts: {
  userId: string;
  posterId: string;
  file?: Buffer;
}): Promise<SellingDecomposeProbe> {
  const looked = await probeSellingDecompose(opts.posterId);
  if (looked.status === "ready" || looked.status === "pending") return looked;
  if (!opts.file) return looked;
  const size = pngSize(opts.file);
  if (!size || size.w < 2 || size.h < 2) {
    throw new Error("卖点图不是有效的 PNG");
  }
  const claim = await claimPending(opts.posterId);
  if (claim === "ready") {
    const pack = await readSellingDecomposePack(opts.posterId);
    if (pack) return { status: "ready", pack };
  }
  if (claim === "pending") return { status: "pending" };
  startJob(opts.posterId, opts.userId, opts.file, size.w, size.h, claim === "local");
  return { status: "pending" };
}
