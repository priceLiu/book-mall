import type { StoryboardReference } from "@/lib/ecom/ecom-storyboard-types";

export class StoryboardProductRefRequiredError extends Error {
  constructor() {
    super("请先上传产品图后再生成分镜图或视频");
    this.name = "StoryboardProductRefRequiredError";
  }
}

function isHttpUrl(url: string | undefined): url is string {
  return Boolean(url?.trim() && /^https?:\/\//.test(url.trim()));
}

/** 全部产品图（上传顺序，去重 URL） */
export function getStoryboardProductRefs(refs: StoryboardReference[]): StoryboardReference[] {
  const seen = new Set<string>();
  const out: StoryboardReference[] = [];
  for (const ref of refs) {
    if (ref.role !== "product" || !isHttpUrl(ref.ossUrl)) continue;
    const url = ref.ossUrl.trim();
    if (seen.has(url)) continue;
    seen.add(url);
    out.push(ref);
  }
  return out;
}

/** 首张产品图（兼容旧调用） */
export function getStoryboardProductRef(
  refs: StoryboardReference[],
): StoryboardReference | null {
  return getStoryboardProductRefs(refs)[0] ?? null;
}

export function requireStoryboardProductRef(
  refs: StoryboardReference[],
): StoryboardReference {
  const product = getStoryboardProductRef(refs);
  if (!product) throw new StoryboardProductRefRequiredError();
  return product;
}

export function getStoryboardCharacterRefs(refs: StoryboardReference[]): StoryboardReference[] {
  return refs.filter((r) => r.role === "character" && isHttpUrl(r.ossUrl));
}

/** 首张角色图（兼容旧调用） */
export function getStoryboardCharacterRef(
  refs: StoryboardReference[],
): StoryboardReference | null {
  return getStoryboardCharacterRefs(refs)[0] ?? null;
}

export function getStoryboardSceneRefs(refs: StoryboardReference[]): StoryboardReference[] {
  return refs.filter(
    (r) => (r.role === "scene" || r.role === "other") && isHttpUrl(r.ossUrl),
  );
}

/**
 * 传给生图 / 视频模型的参考图 URL：
 * - 产品图：始终包含（调用方须先校验存在）
 * - 角色图、场景图：仅在上传时包含
 */
export function resolveStoryboardModelRefUrls(refs: StoryboardReference[]): {
  /** @deprecated 使用 productUrls；首张产品图 */
  productUrl: string;
  productUrls: string[];
  characterUrl?: string;
  sceneUrls: string[];
  /** 按产品（全部）→ 角色 → 场景顺序，供多图模型使用 */
  allUrls: string[];
} {
  const products = getStoryboardProductRefs(refs);
  if (products.length === 0) throw new StoryboardProductRefRequiredError();
  const characters = getStoryboardCharacterRefs(refs);
  const scenes = getStoryboardSceneRefs(refs);

  const productUrls = products.map((p) => p.ossUrl.trim());
  const productUrl = productUrls[0]!;
  const characterUrls = characters.map((c) => c.ossUrl.trim());
  const characterUrl = characterUrls[0];
  const sceneUrls = scenes.map((s) => s.ossUrl.trim());

  const allUrls = [...productUrls, ...characterUrls, ...sceneUrls];

  return { productUrl, productUrls, characterUrl, sceneUrls, allUrls };
}

/**
 * @deprecated 使用 resolveStoryboardVideoRefPlan（ecom-storyboard-video-ref-rules.ts），按模型自动组参考图。
 */
export function resolveStoryboardFullVideoRefs(opts: {
  references: StoryboardReference[];
  sheetPngUrl: string;
  panelImageUrls?: string[];
  /** 除首帧外最多几张参考图（百炼 R2V 等厂商有上限） */
  maxReferenceImages?: number;
}): {
  firstFrameUrl: string;
  referenceImageUrls: string[];
  allUrls: string[];
} {
  const firstFrameUrl = opts.sheetPngUrl.trim();
  const { allUrls: assetRefs } = resolveStoryboardModelRefUrls(opts.references);
  const maxRefs = opts.maxReferenceImages ?? 8;

  const seen = new Set<string>();
  const referenceImageUrls: string[] = [];
  for (const u of assetRefs) {
    if (u === firstFrameUrl || seen.has(u)) continue;
    seen.add(u);
    referenceImageUrls.push(u);
    if (referenceImageUrls.length >= maxRefs) break;
  }

  const allUrls = [firstFrameUrl, ...referenceImageUrls];
  return { firstFrameUrl, referenceImageUrls, allUrls };
}

/** 生图：全部产品图 + 角色 + 场景（调用方按模型上限 slice） */
export function resolveStoryboardImageGenRefs(refs: StoryboardReference[]): {
  /** @deprecated 使用 productRefUrls；首张产品图 */
  productRefUrl: string;
  productRefUrls: string[];
  /** 除首张产品外的参考（角色/场景/其余产品） */
  extraRefUrls: string[];
  /** 送入模型的完整 URL 列表：产品（全部）→ 角色 → 场景 */
  refImageUrls: string[];
} {
  const { productUrl, productUrls, allUrls } = resolveStoryboardModelRefUrls(refs);
  return {
    productRefUrl: productUrl,
    productRefUrls: productUrls,
    extraRefUrls: allUrls.slice(1),
    refImageUrls: allUrls,
  };
}
