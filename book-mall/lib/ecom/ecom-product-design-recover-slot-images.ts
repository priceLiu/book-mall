import {
  ECOM_DETAIL_PAGE_MODULE,
  ECOM_MAIN_IMAGE_MODULE,
  type ProductDesign,
  type ProductDesignDetailPage,
  type ProductDesignMainImage,
} from "@/lib/ecom/ecom-product-design-types";
import { prisma } from "@/lib/prisma";

type SlotTarget = "main" | "detail";

type AssetRow = {
  id: string;
  ossUrl: string;
  prompt: string | null;
  meta: unknown;
  createdAt: Date;
  module: string;
};

function readSlotMeta(
  meta: unknown,
  projectId: string,
): { index?: number; target?: SlotTarget } {
  if (!meta || typeof meta !== "object") return {};
  const o = meta as Record<string, unknown>;
  if (o.projectId !== projectId) return {};
  const index =
    typeof o.index === "number" && Number.isFinite(o.index) && o.index > 0
      ? Math.trunc(o.index)
      : undefined;
  const kind = typeof o.kind === "string" ? o.kind : "";
  let target: SlotTarget | undefined;
  if (kind === "detail_page") target = "detail";
  else if (kind === "main_image") target = "main";
  return { index, target };
}

function moduleToTarget(module: string): SlotTarget | undefined {
  if (module === ECOM_MAIN_IMAGE_MODULE) return "main";
  if (module === ECOM_DETAIL_PAGE_MODULE) return "detail";
  return undefined;
}

function pickLatestAssetBySlot(
  assets: AssetRow[],
  projectId: string,
): Map<string, AssetRow> {
  const map = new Map<string, AssetRow>();
  for (const asset of assets) {
    const fromMeta = readSlotMeta(asset.meta, projectId);
    const target = fromMeta.target ?? moduleToTarget(asset.module);
    const index = fromMeta.index;
    if (!target || index == null) continue;
    const key = `${target}:${index}`;
    if (!map.has(key)) map.set(key, asset);
  }
  return map;
}

/** 槽位缺图但资产库仍有记录时，从 ecomAsset 回填（修复并发覆盖或刷新中断） */
export async function recoverProductDesignImagesFromAssets(
  userId: string,
  projectId: string,
  design: ProductDesign,
): Promise<ProductDesign | null> {
  const missingMain = design.mainImages.filter((m) => !m.imageUrl?.trim());
  const missingDetail = design.detailPages.filter((d) => !d.imageUrl?.trim());
  if (missingMain.length === 0 && missingDetail.length === 0) return null;

  const assets = await prisma.ecomAsset.findMany({
    where: {
      userId,
      module: { in: [ECOM_MAIN_IMAGE_MODULE, ECOM_DETAIL_PAGE_MODULE] },
      kind: "image",
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      ossUrl: true,
      prompt: true,
      meta: true,
      createdAt: true,
      module: true,
    },
  });

  const bySlot = pickLatestAssetBySlot(assets, projectId);
  if (bySlot.size === 0) return null;

  let changed = false;

  const mainImages = design.mainImages.map((m): ProductDesignMainImage => {
    if (m.imageUrl?.trim()) return m;
    const asset = bySlot.get(`main:${m.index}`);
    if (!asset?.ossUrl?.trim()) {
      if (m.assetId) {
        const byId = assets.find((a) => a.id === m.assetId && a.ossUrl?.trim());
        if (byId) {
          changed = true;
          return {
            ...m,
            imageUrl: byId.ossUrl,
            genPrompt: m.genPrompt ?? byId.prompt ?? undefined,
          };
        }
      }
      return m;
    }
    changed = true;
    return {
      ...m,
      imageUrl: asset.ossUrl,
      assetId: asset.id,
      genPrompt: m.genPrompt ?? asset.prompt ?? undefined,
    };
  });

  const detailPages = design.detailPages.map((d): ProductDesignDetailPage => {
    if (d.imageUrl?.trim()) return d;
    const asset = bySlot.get(`detail:${d.index}`);
    if (!asset?.ossUrl?.trim()) {
      if (d.assetId) {
        const byId = assets.find((a) => a.id === d.assetId && a.ossUrl?.trim());
        if (byId) {
          changed = true;
          return {
            ...d,
            imageUrl: byId.ossUrl,
            genPrompt: d.genPrompt ?? byId.prompt ?? undefined,
          };
        }
      }
      return d;
    }
    changed = true;
    return {
      ...d,
      imageUrl: asset.ossUrl,
      assetId: asset.id,
      genPrompt: d.genPrompt ?? asset.prompt ?? undefined,
    };
  });

  if (!changed) return null;
  return { ...design, mainImages, detailPages };
}
