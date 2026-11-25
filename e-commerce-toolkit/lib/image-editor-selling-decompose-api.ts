import { ecomBookFetch } from "@/lib/ecom-book-fetch";

export type SellingPosterDecomposePack = {
  imgW: number;
  imgH: number;
  layers: Array<{
    role: "background" | "block" | "mark" | "text";
    url: string;
    name: string;
    text: string;
    color?: string;
    punched?: boolean;
    z: number;
    x: number;
    y: number;
    w: number;
    h: number;
  }>;
};

const BASE = "api/sso/tools/ecom/image-editor/selling-decompose";

let indexRev = "";
let indexIds: Set<string> | null = null;
let indexTask: Promise<void> | null = null;
const packs = new Map<string, SellingPosterDecomposePack>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function classifyLayer(name: string, fallback: SellingPosterDecomposePack["layers"][number]["role"]): {
  role: SellingPosterDecomposePack["layers"][number]["role"];
  text: string;
} {
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
    if (/圆点|圆圈/.test(trimmed)) return { role: "mark", text: "●" };
    if (/星/.test(trimmed)) return { role: "mark", text: "★" };
    return { role: "mark", text: "✓" };
  }
  if (trimmed.length <= 16 && /[\u4e00-\u9fffA-Za-z0-9]/.test(trimmed) && !/图层|元素|分离|拆分/.test(trimmed)) {
    return { role: "text", text: trimmed };
  }
  return { role: "block", text: "" };
}

function normalizePack(pack: SellingPosterDecomposePack): SellingPosterDecomposePack {
  const classified = pack.layers.map((layer) => {
    const next = classifyLayer(layer.name ?? "", layer.role);
    return { ...layer, role: next.role, text: next.role === "text" || next.role === "mark" ? next.text : "" };
  });
  const hasNamedBackground = classified.some((layer) => layer.name?.trim() && layer.role === "background");
  return {
    ...pack,
    layers: classified.filter((layer) => {
      if (hasNamedBackground && !layer.name?.trim() && layer.role === "background" && layer.h < 0.3) return false;
      return true;
    }),
  };
}

function asPack(raw: unknown): SellingPosterDecomposePack | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as SellingPosterDecomposePack;
  if (!Array.isArray(row.layers) || row.imgW < 2 || row.imgH < 2) return null;
  const pack = normalizePack(row);
  if (!pack.layers.length) return null;
  return pack;
}

async function warmIndex(): Promise<void> {
  if (indexIds) return;
  if (!indexTask) {
    indexTask = (async () => {
      const res = await fetch(`/api/book-mall/${BASE}`, {
        credentials: "include",
        headers: indexRev ? { "If-None-Match": `"${indexRev}"` } : {},
      });
      if (res.status === 304 && indexIds) return;
      const text = await res.text();
      let data: { rev?: string; ids?: string[]; error?: string } = {};
      if (text.trim()) {
        try {
          data = JSON.parse(text) as { rev?: string; ids?: string[]; error?: string };
        } catch {
          throw new Error(res.ok ? "拆层清单格式不对" : `拆层清单加载失败 (${res.status})`);
        }
      } else if (res.status !== 304) {
        throw new Error(res.ok ? "拆层清单是空的" : `拆层清单加载失败 (${res.status})`);
      }
      if (!res.ok) throw new Error(data.error ?? `拆层清单加载失败 (${res.status})`);
      indexRev = typeof data.rev === "string" ? data.rev : "0";
      indexIds = new Set(Array.isArray(data.ids) ? data.ids : []);
    })().finally(() => {
      indexTask = null;
    });
  }
  await indexTask;
}

async function readPack(posterId: string): Promise<SellingPosterDecomposePack | null> {
  const data = await ecomBookFetch(`${BASE}/${posterId}`);
  if (data.status !== "ready") return null;
  const pack = asPack(data.pack);
  if (!pack) return null;
  packs.set(posterId, pack);
  indexIds?.add(posterId);
  return pack;
}

async function pollPack(posterId: string): Promise<SellingPosterDecomposePack> {
  const deadline = Date.now() + 8 * 60 * 1000;
  while (Date.now() < deadline) {
    await sleep(1500);
    const data = await ecomBookFetch(`${BASE}/${posterId}`);
    if (data.status === "ready") {
      const pack = asPack(data.pack);
      if (!pack) throw new Error("拆层结果不完整");
      packs.set(posterId, pack);
      indexIds?.add(posterId);
      return pack;
    }
    if (data.status === "missing") throw new Error("拆分已中断，请再点一次取消组合");
    if (data.status === "failed") {
      throw new Error(typeof data.error === "string" ? data.error : "拆分失败");
    }
  }
  throw new Error("拆分仍在进行，请稍后再点取消组合");
}

function packNeedsFreshSplit(pack: SellingPosterDecomposePack): boolean {
  const combined = pack.layers.some((layer) => layer.role === "block" && /勾/.test(layer.name) && /图标|色块|圆角|方/.test(layer.name));
  const needsColor = pack.layers.some((layer) => (layer.role === "text" || layer.role === "mark") && layer.url && !layer.color);
  const stroke = pack.layers.some((layer) => /描边|边框/.test(layer.name) && !layer.punched);
  return needsColor || stroke || (combined && !pack.layers.some((layer) => layer.role === "mark"));
}

/** 库里有就直接拿。没有才上传这张贴纸并拆一次。 */
export async function ensureSellingPosterDecompose(posterId: string): Promise<SellingPosterDecomposePack> {
  const cached = packs.get(posterId);
  if (cached && !packNeedsFreshSplit(cached)) return normalizePack(cached);
  await warmIndex();
  if (indexIds?.has(posterId)) {
    const pack = await readPack(posterId);
    if (pack) return pack;
  }
  const probe = await ecomBookFetch(`${BASE}/${posterId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ posterId }),
  });
  if (probe.status === "ready") {
    const pack = asPack(probe.pack);
    if (!pack) throw new Error("拆层结果不完整");
    packs.set(posterId, pack);
    indexIds?.add(posterId);
    return pack;
  }
  if (probe.status === "pending") return pollPack(posterId);

  const image = await fetch(`/image-editor/selling/${posterId}.png`);
  if (!image.ok) throw new Error("这张卖点图没有加载成功");
  const blob = await image.blob();
  const form = new FormData();
  form.set("posterId", posterId);
  form.set("file", blob, `${posterId}.png`);
  const started = await ecomBookFetch(`${BASE}/${posterId}`, { method: "POST", body: form });
  if (started.status === "ready") {
    const pack = asPack(started.pack);
    if (!pack) throw new Error("拆层结果不完整");
    packs.set(posterId, pack);
    indexIds?.add(posterId);
    return pack;
  }
  return pollPack(posterId);
}
