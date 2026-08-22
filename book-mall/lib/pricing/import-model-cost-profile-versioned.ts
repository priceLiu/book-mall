/**
 * 脚本/导入共用：写入 ModelCostProfile（关旧开新）。
 */
import type { CreditChannel, CreditCostUnit } from "@prisma/client";

import {
  upsertModelCostProfileVersioned,
  type VersionedCostProfileResult,
} from "@/lib/pricing/upsert-model-cost-profile-versioned";

export type ImportModelCostProfileInput = {
  canonicalModelKey: string;
  vendor: string;
  unit: CreditCostUnit;
  tierRaw?: string | null;
  listCostYuan: number;
  inputListCostYuan?: number | null;
  outputListCostYuan?: number | null;
  discountRate?: number;
  note?: string | null;
  seedId?: string;
  channel?: CreditChannel;
};

export async function importModelCostProfileVersioned(
  input: ImportModelCostProfileInput,
): Promise<VersionedCostProfileResult> {
  return upsertModelCostProfileVersioned({
    vendor: input.vendor,
    canonicalModelKey: input.canonicalModelKey,
    channel: input.channel ?? "CHANNEL",
    unit: input.unit,
    tierRaw: input.tierRaw ?? null,
    listCostYuan: input.listCostYuan,
    inputListCostYuan: input.inputListCostYuan ?? null,
    outputListCostYuan: input.outputListCostYuan ?? null,
    discountRate: input.discountRate ?? 0,
    note: input.note ?? null,
    seedId: input.seedId,
  });
}
