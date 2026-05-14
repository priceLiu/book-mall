import { createHash } from "crypto";
import type { PricingBillingKind } from "@prisma/client";

export function pricingLineFingerprint(
  billingKind: PricingBillingKind,
  modelKey: string,
  tierRaw: string,
): string {
  const t = `${billingKind}|${modelKey.trim()}|${tierRaw.trim()}`;
  return createHash("sha256").update(t, "utf8").digest("hex").slice(0, 40);
}

export type LineSnapshot = {
  billingKind: PricingBillingKind;
  modelKey: string;
  tierRaw: string;
  inputYuanPerMillion: number | null;
  outputYuanPerMillion: number | null;
  costJson: unknown | null;
};

export function draftToSnapshot(d: {
  billingKind: PricingBillingKind;
  modelKey: string;
  tierRaw: string;
  inputYuanPerMillion: number | null;
  outputYuanPerMillion: number | null;
  costJson: unknown | null;
}): LineSnapshot {
  return {
    billingKind: d.billingKind,
    modelKey: d.modelKey,
    tierRaw: d.tierRaw,
    inputYuanPerMillion: d.inputYuanPerMillion,
    outputYuanPerMillion: d.outputYuanPerMillion,
    costJson: d.costJson ?? null,
  };
}

export function snapshotsEqual(a: LineSnapshot, b: LineSnapshot): boolean {
  return (
    a.billingKind === b.billingKind &&
    a.modelKey === b.modelKey &&
    a.tierRaw === b.tierRaw &&
    a.inputYuanPerMillion === b.inputYuanPerMillion &&
    a.outputYuanPerMillion === b.outputYuanPerMillion &&
    JSON.stringify(a.costJson) === JSON.stringify(b.costJson)
  );
}
