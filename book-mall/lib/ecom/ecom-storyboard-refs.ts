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

/** 产品图（必填） */
export function getStoryboardProductRef(
  refs: StoryboardReference[],
): StoryboardReference | null {
  return refs.find((r) => r.role === "product" && isHttpUrl(r.ossUrl)) ?? null;
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
  productUrl: string;
  characterUrl?: string;
  sceneUrls: string[];
  /** 按产品 → 角色 → 场景顺序，供多图模型使用 */
  allUrls: string[];
} {
  const product = requireStoryboardProductRef(refs);
  const characters = getStoryboardCharacterRefs(refs);
  const scenes = getStoryboardSceneRefs(refs);

  const productUrl = product.ossUrl.trim();
  const characterUrls = characters.map((c) => c.ossUrl.trim());
  const characterUrl = characterUrls[0];
  const sceneUrls = scenes.map((s) => s.ossUrl.trim());

  const allUrls = [productUrl, ...characterUrls, ...sceneUrls];

  return { productUrl, characterUrl, sceneUrls, allUrls };
}

/**
 * 整图成片：完整分镜 PNG 作首帧；产品/角色/场景 + 各镜头分镜图作 reference_image。
 */
export function resolveStoryboardFullVideoRefs(opts: {
  references: StoryboardReference[];
  sheetPngUrl: string;
  panelImageUrls?: string[];
}): {
  firstFrameUrl: string;
  referenceImageUrls: string[];
  allUrls: string[];
} {
  const firstFrameUrl = opts.sheetPngUrl.trim();
  const { allUrls: assetRefs } = resolveStoryboardModelRefUrls(opts.references);
  const panelUrls = (opts.panelImageUrls ?? [])
    .map((u) => u.trim())
    .filter((u) => /^https?:\/\//.test(u) && u !== firstFrameUrl);

  const seen = new Set<string>();
  const referenceImageUrls: string[] = [];
  for (const u of [...assetRefs, ...panelUrls]) {
    if (u === firstFrameUrl || seen.has(u)) continue;
    seen.add(u);
    referenceImageUrls.push(u);
  }

  const allUrls = [firstFrameUrl, ...referenceImageUrls];
  return { firstFrameUrl, referenceImageUrls, allUrls };
}

/** 生图：产品垫图 + 可选附加参考（角色/场景） */
export function resolveStoryboardImageGenRefs(refs: StoryboardReference[]): {
  productRefUrl: string;
  extraRefUrls: string[];
} {
  const { productUrl, allUrls } = resolveStoryboardModelRefUrls(refs);
  const extraRefUrls = allUrls.slice(1);
  return { productRefUrl: productUrl, extraRefUrls };
}
