import type { PricingBillingKind } from "@prisma/client";

export type PriceMdChinaTokenRow = {
  sectionH2: string;
  sectionH3: string;
  modelRaw: string;
  modelKeys: string[];
  tierRaw: string;
  inputYuanPerMillion: number;
  outputYuanPerMillion: number;
  sourceLine: number;
};

export type PriceMdChinaExtractMeta = {
  generatedAt: string;
  sourceRelativePath: string;
  sourceSha256: string;
  rowCount: number;
  warnings: string[];
};

export type PriceMdChinaExtract = {
  meta: PriceMdChinaExtractMeta;
  rows: PriceMdChinaTokenRow[];
};

export type PricingDraftLine = {
  sectionH2: string;
  sectionH3: string;
  modelKey: string;
  modelLabelRaw: string;
  tierRaw: string;
  billingKind: PricingBillingKind;
  inputYuanPerMillion: number | null;
  outputYuanPerMillion: number | null;
  costJson: unknown | null;
  sourceLine: number | null;
};
