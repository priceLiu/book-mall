import type { ReconciliationPeriod } from "./period-range";
import { periodKey as toPeriodKey } from "./period-range";

export type ReconciliationVendor = string;
export type ReconciliationPriceMode = "list" | "payable";
export type ReconciliationEngineVersion = "v1" | "v2";

export type UnitKind =
  | "SEC"
  | "IMAGE"
  | "KTOKEN"
  | "AUDIO_SEC"
  | "CHAR_10K"
  | "CALL";

export type TokenDirection = "input" | "output" | "cache" | "none";

export type ReconStatus =
  | "OK"
  | "OVER_PLATFORM"
  | "UNDER_PLATFORM"
  | "MISSING_PLATFORM"
  | "MISSING_VENDOR"
  | "PRICE_MISMATCH"
  | "UNBOUND";

export type VendorBillLine = {
  vendor: ReconciliationVendor;
  joinKey: string;
  /** @deprecated 用 periodKey；保留 YYYYMM 便于展示 */
  month: string;
  period: ReconciliationPeriod;
  periodKey: string;
  cloudAccountId: string | null;
  modelKey: string;
  tierRaw: string | null;
  unitKind: UnitKind;
  tokenDirection: TokenDirection;
  vendorUnits: number;
  listUnitYuan: number;
  vendorListYuan: number;
  csvRowCount: number;
};

export type PlatformUsageLine = {
  vendor: ReconciliationVendor;
  joinKey: string;
  month: string;
  period: ReconciliationPeriod;
  periodKey: string;
  userId: string | null;
  modelKey: string;
  tierRaw: string | null;
  unitKind: UnitKind;
  tokenDirection: TokenDirection;
  platformUnits: number;
  listUnitYuan: number;
  platformListYuan: number;
  platformNetCostYuan: number;
  platformCredits: number;
  platformRevenueYuan: number;
  callCount: number;
  sampleLogIds: string[];
};

export type ReconciliationResultRow = {
  /** joinKey 中的厂商 code（ModelCatalog / 推断） */
  vendor: ReconciliationVendor;
  /** 填入厂商列的 CSV 来源；无 CSV 则为 null */
  importVendor: string | null;
  joinKey: string;
  month: string;
  period: ReconciliationPeriod;
  periodKey: string;
  userId: string | null;
  cloudAccountId: string | null;
  modelKey: string;
  tierRaw: string | null;
  unitKind: UnitKind;
  tokenDirection: TokenDirection;
  vendorUnits: number;
  platformUnits: number;
  usageDiff: number;
  listUnitYuan: number;
  vendorListYuan: number;
  platformListYuan: number;
  platformNetCostYuan: number;
  amountDiffYuan: number;
  platformCredits: number;
  platformRevenueYuan: number;
  reconStatus: ReconStatus;
  issueReason: string | null;
  sampleLogIds: string[];
};

export type ReconciliationV2Summary = {
  engineVersion: "v2";
  vendor: ReconciliationVendor;
  priceMode: ReconciliationPriceMode;
  csvRowCount: number;
  monthsCovered: string[];
  /** 对账日历区间（与 CSV / 平台 Gateway 一致） */
  periodFrom: string;
  periodTo: string;
  periodKey: string;
  boundUsers: number;
  unboundCloudAccounts: Array<{
    cloudAccountId: string;
    cloudAccountName: string | null;
    csvRowCount: number;
    vendorListYuan: number;
  }>;
  totalVendorListYuan: number;
  totalPlatformListYuan: number;
  totalAmountDiffYuan: number;
  totalPlatformCredits: number;
  totalPlatformRevenueYuan: number;
  okCount: number;
  issueCount: number;
  statusCounts: Record<ReconStatus, number>;
};

export type ReconciliationV2Result = {
  runId: string;
  summary: ReconciliationV2Summary;
  lines: ReconciliationResultRow[];
};
