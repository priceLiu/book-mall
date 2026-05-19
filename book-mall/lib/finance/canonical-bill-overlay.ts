/**
 * v004（2026-05-17）：把"账单行 cloudRow 里五花八门的厂商列"按 ModelCatalog/ModelAlias 反查，
 * **统一覆写为 canonical**，并把命中信息固化进新的「平台/*」列。
 *
 * 解决问题：「费用明细」头部统计与厂商列下拉筛选不一致——
 *   - `TOOL_USAGE_GENERATED` 行：cloudRow 已由 `buildCloudRowFromUsage` 直接写好「平台/产品Code+名称」；
 *   - `CLOUD_CSV_IMPORT` 行：cloudRow 来自阿里云 CSV 原值（"产品名称=百炼大模型"、"商品名称=百炼大模型 Happy 系列"），
 *     没有「平台/*」列；本 overlay 在读侧反查 ModelAlias→ModelCatalog，**补齐**「平台/*」 6 列。
 *
 * 覆写策略（自上而下，谁先命中谁说了算）：
 *   1) `产品信息/规格`        → 反查 VENDOR_RESOURCE_SPEC
 *   2) `产品信息/商品Code`     → VENDOR_COMMODITY_CODE
 *   3) `产品信息/计费项Code`   → VENDOR_BILLABLE_ITEM
 *   4) `产品信息/产品名称`     → VENDOR_PRODUCT_NAME
 *
 * 命中后写入 6 列：
 *   - 「平台/产品Code」= catalog.canonicalKey
 *   - 「平台/产品名称」= catalog.displayName（如有档位则附 "（1080P）"等后缀）
 *   - 「平台/计费项Code」: 若行内已有则保留，否则用 cloudRow["产品信息/计费项Code"] 兜底
 *   - 「平台/系数(M)」: 若行内已有（TOOL_USAGE_GENERATED 已写好）保留；CSV 行没有 → 留空
 *   - 「平台/定价」: 同上
 *   - 「平台/扣点」: 同上（CSV 行的"扣点"在 `enrichBillingLineToFlatRow` 里从 internal* DB 列注入）
 *
 * 找不到 → 保留原值。
 *
 * v004 删除：旧的 K_CANONICAL="产品信息/标准模型" 与 K_TIER="产品信息/档位" 写入，
 *   以及覆写 cloudRow 的"产品信息/产品名称 / 商品名称 / 规格 / 产品Code"——
 *   旧"造"的列已不在前端展示列表里，保留原值即可（CSV 行的真值仍然可见）。
 */
import { prisma } from "@/lib/prisma";
import { ModelAliasSource } from "@prisma/client";

export type CanonicalCatalogInfo = {
  canonicalKey: string;
  displayName: string;
  vendor: string;
  defaultTierRaw: string | null;
  unitLabel: string;
};

const K_SPEC = "产品信息/规格";
const K_COMMODITY_CODE = "产品信息/商品Code";
const K_BILLABLE_CODE = "产品信息/计费项Code";
const K_PRODUCT_NAME = "产品信息/产品名称";

// v004 新增的目标列（写侧）
const K_P_PRODUCT_CODE = "平台/产品Code";
const K_P_PRODUCT_NAME = "平台/产品名称";
const K_P_BILLABLE_CODE = "平台/计费项Code";

/** `TOOL_USAGE_GENERATED` 行在 `tool-usage-billing-line` 内写入的 `平台账单/费用类型` 固定值。 */
const K_PLATFORM_BILL_FEE_TYPE = "平台账单/费用类型";
const TOOL_SITE_USAGE_FEE = "工具站使用费";

function isToolUsageGeneratedFlatRow(row: Record<string, string>): boolean {
  return (row[K_PLATFORM_BILL_FEE_TYPE] ?? "").trim() === TOOL_SITE_USAGE_FEE;
}

type AliasLookupKey = `${ModelAliasSource}::${string}`;

/**
 * 一次性把"本批账单行涉及的所有 alias 字串"批量查库，构建 lookup Map。
 * 之后 `applyCanonicalOverlay` 每行只做内存查找，避免 N+1 DB 往返。
 */
export async function buildCanonicalOverlayLookup(
  rows: Array<Record<string, string>>,
): Promise<Map<AliasLookupKey, CanonicalCatalogInfo>> {
  if (rows.length === 0) return new Map();
  const seen = new Set<string>();
  const aliasInputs: Array<{ source: ModelAliasSource; aliasValue: string }> = [];
  const push = (source: ModelAliasSource, v: string | undefined) => {
    if (!v) return;
    const trimmed = v.trim();
    if (!trimmed) return;
    const k = `${source}::${trimmed}`;
    if (seen.has(k)) return;
    seen.add(k);
    aliasInputs.push({ source, aliasValue: trimmed });
  };

  for (const r of rows) {
    push(ModelAliasSource.VENDOR_RESOURCE_SPEC, r[K_SPEC]);
    push(ModelAliasSource.VENDOR_COMMODITY_CODE, r[K_COMMODITY_CODE]);
    push(ModelAliasSource.VENDOR_BILLABLE_ITEM, r[K_BILLABLE_CODE]);
    push(ModelAliasSource.VENDOR_PRODUCT_NAME, r[K_PRODUCT_NAME]);
  }
  if (aliasInputs.length === 0) return new Map();

  const hits = await prisma.modelAlias.findMany({
    where: {
      active: true,
      OR: aliasInputs,
      catalog: { active: true },
    },
    select: {
      source: true,
      aliasValue: true,
      catalog: {
        select: {
          canonicalKey: true,
          displayName: true,
          vendor: true,
          defaultTierRaw: true,
          unitLabel: true,
        },
      },
    },
  });

  const out = new Map<AliasLookupKey, CanonicalCatalogInfo>();
  for (const h of hits) {
    if (!h.catalog) continue;
    out.set(`${h.source}::${h.aliasValue}`, {
      canonicalKey: h.catalog.canonicalKey,
      displayName: h.catalog.displayName,
      vendor: h.catalog.vendor,
      defaultTierRaw: h.catalog.defaultTierRaw,
      unitLabel: h.catalog.unitLabel,
    });
  }
  return out;
}

/**
 * 单行覆写：按规格 → 商品Code → 计费项Code → 产品名称 顺序找到命中即把
 * `平台/产品Code + 平台/产品名称 + 平台/计费项Code` 写入。
 * 不修改原对象，返回浅拷贝。
 */
export function applyCanonicalOverlay(
  row: Record<string, string>,
  lookup: Map<AliasLookupKey, CanonicalCatalogInfo>,
): Record<string, string> {
  if (lookup.size === 0) return row;

  /**
   * `TOOL_USAGE_GENERATED` 行在写入时已带齐「平台/*」与 catalog 派生的厂商列；
   * 读侧再用 VENDOR_* 别名表覆写时，多种能力会共用同一厂商「计费项 Code」（如 image_number），
   * Map 后写覆盖 / 短路命中会把文生图等项目错显示为试衣间等。
   */
  if (isToolUsageGeneratedFlatRow(row)) return row;

  let hit: CanonicalCatalogInfo | undefined;
  const lookups: Array<[ModelAliasSource, string]> = [
    [ModelAliasSource.VENDOR_RESOURCE_SPEC, row[K_SPEC] ?? ""],
    [ModelAliasSource.VENDOR_COMMODITY_CODE, row[K_COMMODITY_CODE] ?? ""],
    [ModelAliasSource.VENDOR_BILLABLE_ITEM, row[K_BILLABLE_CODE] ?? ""],
    [ModelAliasSource.VENDOR_PRODUCT_NAME, row[K_PRODUCT_NAME] ?? ""],
  ];
  for (const [src, val] of lookups) {
    if (!val.trim()) continue;
    const found = lookup.get(`${src}::${val.trim()}`);
    if (found) {
      hit = found;
      break;
    }
  }
  if (!hit) return row;

  // 档位优先从行内取（CSV 行通常有"规格=1080P"），否则用 catalog 默认档位
  const existingSpec = row[K_SPEC] ?? "";
  const tierGuess =
    (/(720P|1080P|480P)/i.exec(existingSpec)?.[1] ?? "") ||
    hit.defaultTierRaw ||
    "";

  const displaySuffix = tierGuess ? `（${tierGuess}）` : "";
  const overlay: Record<string, string> = {
    ...row,
    [K_P_PRODUCT_CODE]: hit.canonicalKey,
    [K_P_PRODUCT_NAME]: `${hit.displayName}${displaySuffix}`,
  };
  // 计费项 Code：行内已有则保留，否则用 CSV 的"计费项 Code"兜底
  if (!overlay[K_P_BILLABLE_CODE] || !overlay[K_P_BILLABLE_CODE].trim()) {
    overlay[K_P_BILLABLE_CODE] = row[K_BILLABLE_CODE]?.trim() || "";
  }
  return overlay;
}

/** 批量便捷版：一次查库 + map。 */
export async function applyCanonicalOverlayBatch(
  rows: Array<Record<string, string>>,
): Promise<Array<Record<string, string>>> {
  if (rows.length === 0) return rows;
  if (rows.every(isToolUsageGeneratedFlatRow)) return rows;
  const forLookup = rows.filter((r) => !isToolUsageGeneratedFlatRow(r));
  const lookup = await buildCanonicalOverlayLookup(forLookup);
  if (lookup.size === 0) return rows;
  return rows.map((r) => applyCanonicalOverlay(r, lookup));
}
