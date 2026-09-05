/**
 * 厂商挂牌价 → ModelCostProfile 同步（关旧开新），并重发 ModelCreditPrice。
 */
import { CreditChannel, CreditCostUnit } from "@prisma/client";

import { publishModelCreditPrice } from "@/lib/pricing/credit-pricing-engine";
import {
  upsertModelCostProfileVersioned,
} from "@/lib/pricing/upsert-model-cost-profile-versioned";
import { prisma } from "@/lib/prisma";
import type { TokenDirection, UnitKind, VendorBillLine } from "@/lib/finance/reconciliation-v2/types";

export type SyncVendorListCostOptions = {
  republishCredits?: boolean;
  publishedBy?: string;
  updateExistingOnly?: boolean;
};

export type SyncVendorListCostResult = {
  profilesUpserted: number;
  profilesSkipped: number;
  creditsPublished: number;
  creditsSkipped: number;
  errors: string[];
};

type ProfilePatch = {
  vendor: string;
  canonicalModelKey: string;
  tierRaw: string | null;
  unit: CreditCostUnit;
  listCostYuan?: number;
  inputListCostYuan?: number;
  outputListCostYuan?: number;
};

const DEFAULT_DISCOUNT: Record<string, number> = {
  aliyun: 0.1,
  deepseek: 0,
  kie: 0.05,
};

const DEFAULT_CHANNEL: Record<string, CreditChannel> = {
  aliyun: CreditChannel.CHANNEL,
  deepseek: CreditChannel.OWN,
  kie: CreditChannel.CHANNEL,
};

function unitKindToCreditUnit(unitKind: UnitKind): CreditCostUnit | null {
  switch (unitKind) {
    case "SEC":
    case "AUDIO_SEC":
      return CreditCostUnit.PER_SEC;
    case "IMAGE":
      return CreditCostUnit.PER_IMAGE;
    case "KTOKEN":
      return CreditCostUnit.PER_KTOKEN;
    default:
      return null;
  }
}

function profileGroupKey(p: ProfilePatch): string {
  return `${p.vendor}|${p.canonicalModelKey}|${p.tierRaw ?? ""}|${p.unit}`;
}

function mergeVendorLineIntoPatches(
  patches: Map<string, ProfilePatch>,
  line: VendorBillLine,
): void {
  if (!(line.listUnitYuan > 0)) return;
  const vendor = line.vendor?.trim();
  if (!vendor) return;
  const unit = unitKindToCreditUnit(line.unitKind);
  if (!unit) return;

  const modelKey = line.modelKey.trim();
  if (!modelKey || modelKey === "(unknown)") return;

  const base: ProfilePatch = {
    vendor,
    canonicalModelKey: modelKey,
    tierRaw: line.tierRaw,
    unit,
  };
  const key = profileGroupKey(base);
  const cur = patches.get(key) ?? { ...base };

  if (unit === CreditCostUnit.PER_KTOKEN) {
    if (line.tokenDirection === "input") {
      cur.inputListCostYuan = line.listUnitYuan;
    } else if (line.tokenDirection === "output") {
      cur.outputListCostYuan = line.listUnitYuan;
    } else {
      cur.listCostYuan = line.listUnitYuan;
      if (cur.inputListCostYuan == null) cur.inputListCostYuan = line.listUnitYuan;
    }
  } else {
    cur.listCostYuan = line.listUnitYuan;
  }

  patches.set(key, cur);
}

export function buildVendorListCostPatches(lines: VendorBillLine[]): ProfilePatch[] {
  const patches = new Map<string, ProfilePatch>();
  for (const line of lines) {
    mergeVendorLineIntoPatches(patches, line);
  }
  return [...patches.values()];
}

async function resolveExistingProfile(p: ProfilePatch) {
  return prisma.modelCostProfile.findFirst({
    where: {
      canonicalModelKey: p.canonicalModelKey,
      vendor: p.vendor,
      active: true,
      effectiveTo: null,
      ...(p.tierRaw ? { tierRaw: p.tierRaw } : { tierRaw: null }),
    },
    orderBy: { effectiveFrom: "desc" },
  });
}

async function upsertProfileFromPatch(
  p: ProfilePatch,
  opts: SyncVendorListCostOptions,
): Promise<"upserted" | "skipped"> {
  const existing = await resolveExistingProfile(p);
  if (!existing && opts.updateExistingOnly) return "skipped";

  const channel = existing?.channel ?? DEFAULT_CHANNEL[p.vendor] ?? CreditChannel.CHANNEL;
  const discountRate =
    existing != null ? Number(existing.discountRate) : (DEFAULT_DISCOUNT[p.vendor] ?? 0.1);

  const inList = p.inputListCostYuan ?? (existing ? Number(existing.inputListCostYuan) : 0);
  const outList = p.outputListCostYuan ?? (existing ? Number(existing.outputListCostYuan) : 0);
  let listCostYuan =
    p.listCostYuan ??
    (inList > 0 ? inList : existing ? Number(existing.listCostYuan) : 0);

  if (p.unit === CreditCostUnit.PER_KTOKEN && inList > 0 && outList > 0) {
    listCostYuan = inList;
  }

  if (!(listCostYuan > 0) && !(inList > 0 || outList > 0)) return "skipped";

  const note = `vendor list price sync · ${new Date().toISOString().slice(0, 10)}`;
  const result = await upsertModelCostProfileVersioned({
    vendor: p.vendor,
    canonicalModelKey: p.canonicalModelKey,
    channel,
    unit: p.unit,
    tierRaw: p.tierRaw,
    listCostYuan,
    inputListCostYuan: inList > 0 ? inList : null,
    outputListCostYuan: outList > 0 ? outList : null,
    discountRate,
    note,
  });

  return result.action === "unchanged" ? "skipped" : "upserted";
}

async function displayNameForKey(canonicalModelKey: string): Promise<string> {
  const existing = await prisma.modelCreditPrice.findUnique({
    where: { canonicalModelKey },
    select: { displayName: true },
  });
  if (existing?.displayName) return existing.displayName;
  const catalog = await prisma.modelCatalog.findUnique({
    where: { canonicalKey: canonicalModelKey },
    select: { displayName: true },
  });
  if (catalog?.displayName) return catalog.displayName;
  return canonicalModelKey.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function syncVendorListPricesFromBillLines(
  lines: VendorBillLine[],
  opts: SyncVendorListCostOptions = {},
): Promise<SyncVendorListCostResult> {
  const republish = opts.republishCredits !== false;
  const publishedBy = opts.publishedBy ?? "sync-vendor-list-cost-profile";
  const patches = buildVendorListCostPatches(lines);

  let profilesUpserted = 0;
  let profilesSkipped = 0;
  const creditKeys = new Set<string>();
  const errors: string[] = [];

  for (const patch of patches) {
    try {
      const r = await upsertProfileFromPatch(patch, opts);
      if (r === "upserted") {
        profilesUpserted += 1;
        creditKeys.add(patch.canonicalModelKey);
      } else {
        profilesSkipped += 1;
      }
    } catch (e) {
      errors.push(
        `${patch.canonicalModelKey}: ${e instanceof Error ? e.message : String(e)}`,
      );
      profilesSkipped += 1;
    }
  }

  let creditsPublished = 0;
  let creditsSkipped = 0;
  if (republish) {
    for (const key of creditKeys) {
      try {
        await publishModelCreditPrice({
          canonicalModelKey: key,
          displayName: await displayNameForKey(key),
          publishedBy,
        });
        creditsPublished += 1;
      } catch (e) {
        errors.push(
          `credit:${key}: ${e instanceof Error ? e.message : String(e)}`,
        );
        creditsSkipped += 1;
      }
    }
  }

  return { profilesUpserted, profilesSkipped, creditsPublished, creditsSkipped, errors };
}
