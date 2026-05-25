import { prisma } from "@/lib/prisma";

type Mapping = {
  vendorProductName: string;
  vendorCommodityCode: string;
  vendorCommodityName: string;
  vendorBillableItemCode: string;
  vendorBillableItemName: string;
};

const ALIYUN_BY_BILLING_KIND: Record<string, Mapping> = {
  VIDEO_MODEL_SPEC: {
    vendorProductName: "大模型服务平台百炼",
    vendorCommodityCode: "sfm_inferenceHH_public_cn",
    vendorCommodityName: "百炼大模型Happy系列",
    vendorBillableItemCode: "video_duration",
    vendorBillableItemName: "视频生成模型用量",
  },
  COST_PER_IMAGE: {
    vendorProductName: "大模型服务平台百炼",
    vendorCommodityCode: "sfm_inference_public_cn",
    vendorCommodityName: "百炼大模型推理",
    vendorBillableItemCode: "image_number",
    vendorBillableItemName: "大模型图片生成量",
  },
  OUTPUT_IMAGE: {
    vendorProductName: "大模型服务平台百炼",
    vendorCommodityCode: "sfm_inference_public_cn",
    vendorCommodityName: "百炼大模型推理",
    vendorBillableItemCode: "image_number",
    vendorBillableItemName: "大模型图片生成量",
  },
  TOKEN_IN_OUT: {
    vendorProductName: "大模型服务平台百炼",
    vendorCommodityCode: "sfm_inference_public_cn",
    vendorCommodityName: "百炼大模型推理",
    vendorBillableItemCode: "tokens",
    vendorBillableItemName: "大模型 Token 用量",
  },
};

const OVERRIDES: Record<string, Mapping> = {
  aitryon: {
    vendorProductName: "大模型服务平台百炼",
    vendorCommodityCode: "sfm_inference_public_cn",
    vendorCommodityName: "百炼大模型推理",
    vendorBillableItemCode: "image_number",
    vendorBillableItemName: "大模型图片生成量",
  },
  "aitryon-plus": {
    vendorProductName: "大模型服务平台百炼",
    vendorCommodityCode: "sfm_inference_public_cn",
    vendorCommodityName: "百炼大模型推理",
    vendorBillableItemCode: "image_number",
    vendorBillableItemName: "大模型图片生成量",
  },
};

export type BackfillVendorFieldsResult = {
  updated: number;
  alreadyFilled: number;
  noMapping: number;
};

/**
 * 按 vendor × billingKind 回填 ModelCatalog 的 5 个 vendor* 字段（不覆盖已有值）。
 */
export async function backfillModelCatalogVendorFields(opts?: {
  verbose?: boolean;
}): Promise<BackfillVendorFieldsResult> {
  const verbose = opts?.verbose ?? false;
  const cats = await prisma.modelCatalog.findMany({
    where: { active: true },
    select: {
      id: true,
      canonicalKey: true,
      vendor: true,
      billingKind: true,
      vendorProductName: true,
      vendorCommodityCode: true,
      vendorCommodityName: true,
      vendorBillableItemCode: true,
      vendorBillableItemName: true,
    },
  });

  let updated = 0;
  let alreadyFilled = 0;
  let noMapping = 0;

  for (const c of cats) {
    const override = OVERRIDES[c.canonicalKey];
    const defaultMap =
      c.vendor === "aliyun" ? ALIYUN_BY_BILLING_KIND[c.billingKind] : undefined;
    const m = override ?? defaultMap;
    if (!m) {
      noMapping += 1;
      continue;
    }

    const upd: Partial<Mapping> = {};
    if (!c.vendorProductName) upd.vendorProductName = m.vendorProductName;
    if (!c.vendorCommodityCode) upd.vendorCommodityCode = m.vendorCommodityCode;
    if (!c.vendorCommodityName) upd.vendorCommodityName = m.vendorCommodityName;
    if (!c.vendorBillableItemCode) upd.vendorBillableItemCode = m.vendorBillableItemCode;
    if (!c.vendorBillableItemName) upd.vendorBillableItemName = m.vendorBillableItemName;

    if (Object.keys(upd).length === 0) {
      alreadyFilled += 1;
      continue;
    }

    await prisma.modelCatalog.update({
      where: { id: c.id },
      data: upd,
    });
    updated += 1;
    if (verbose) {
      console.log(
        `[backfill-vendor] ${c.canonicalKey} (${c.vendor}/${c.billingKind}): ${Object.keys(upd).join(", ")}`,
      );
    }
  }

  return { updated, alreadyFilled, noMapping };
}
