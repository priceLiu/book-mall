/**
 * v006 Round 4 一次性回填：按 `vendor + billingKind` 给所有 ModelCatalog 行填上 5 个 vendor* 字段
 * （费用明细「厂商产品」5 列默认值）。
 *
 * 设计：现在不上 admin UI 编辑界面（后续 Round 再做），先用一个可复跑的脚本：
 *   - 按 vendor=aliyun + billingKind 给 4 列填阿里云的标准命名；
 *   - vendorProductName 一律填 "大模型服务平台百炼"（所有当前 catalog 都是百炼）；
 *   - 字段已有值的行跳过（"管理员手动改过就不要覆盖"）。
 *
 * 未来添加新 vendor（腾讯/华为等）时在本脚本里加分支，重跑即可。
 *
 * 维护性考虑（用户原话："云厂商的模型会增多, 价格会变动, 云厂商也会增多"）：
 *   - 模型增多   → 此脚本只按 billingKind 默认填，新增模型重跑即可批量带回；
 *   - 价格变动   → 不影响本脚本（价格在 PricingSourceLine / ToolBillablePrice 各自版本/时效里）；
 *   - 厂商增多   → 在下面 `MAPPINGS_BY_VENDOR` 里加新分支；
 *   - 1 catalog 跨多家云 → 当前 schema 1:1 设计，未来如需 1:N 再 split 出 `ModelCatalogVendorBinding`。
 */
import { prisma } from "../lib/prisma";

type Mapping = {
  vendorProductName: string;
  vendorCommodityCode: string;
  vendorCommodityName: string;
  vendorBillableItemCode: string;
  vendorBillableItemName: string;
};

/**
 * vendor=aliyun 的 4 维默认映射（按 PricingBillingKind 区分）。
 * 这些值都参考自 `tool-web/doc/1068915519298264-20260516105620_consumedetailbillv2.csv` 真实账单 + 阿里云控制台命名口径。
 */
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
    // 阿里云 LLM 出账分两行 input_tokens / output_tokens，我方扣点是合并算一行；占位 "tokens"
    vendorBillableItemCode: "tokens",
    vendorBillableItemName: "大模型 Token 用量",
  },
};

/**
 * 个别 canonical 的覆盖映射（如 aitryon 是 AI 试衣专门商品，不走 happy 系列）。
 * 这里只有 vic 实际命中的 aitryon；新增请逐条加。
 */
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

async function main() {
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
  let skippedPartial = 0;
  let skippedNoMapping = 0;

  for (const c of cats) {
    const override = OVERRIDES[c.canonicalKey];
    const defaultMap =
      c.vendor === "aliyun" ? ALIYUN_BY_BILLING_KIND[c.billingKind] : undefined;
    const m = override ?? defaultMap;
    if (!m) {
      skippedNoMapping += 1;
      continue;
    }

    // 不覆盖已有值（admin 可能改过）
    const upd: Partial<Mapping> = {};
    if (!c.vendorProductName) upd.vendorProductName = m.vendorProductName;
    if (!c.vendorCommodityCode) upd.vendorCommodityCode = m.vendorCommodityCode;
    if (!c.vendorCommodityName) upd.vendorCommodityName = m.vendorCommodityName;
    if (!c.vendorBillableItemCode) upd.vendorBillableItemCode = m.vendorBillableItemCode;
    if (!c.vendorBillableItemName) upd.vendorBillableItemName = m.vendorBillableItemName;

    if (Object.keys(upd).length === 0) {
      skippedPartial += 1;
      continue;
    }

    await prisma.modelCatalog.update({
      where: { id: c.id },
      data: upd,
    });
    updated += 1;
    console.log(
      `[backfill] updated ${c.canonicalKey} (${c.vendor}/${c.billingKind}): ${Object.keys(upd).join(", ")}`,
    );
  }

  console.log("");
  console.log("[backfill] done:");
  console.log(`  updated:        ${updated}`);
  console.log(`  already filled: ${skippedPartial}`);
  console.log(`  no-mapping:     ${skippedNoMapping}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
