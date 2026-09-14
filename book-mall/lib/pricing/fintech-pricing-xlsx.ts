/**
 * Fintech AI 第三方报价单 xlsx → ModelCostProfile 导入行。
 * 折扣列 = 实付系数（挂牌 × 系数）；写入 discountRate = 1 − 系数。
 */
import type { CreditCostUnit } from "@prisma/client";
import * as XLSX from "xlsx";

import type { ImportModelCostProfileInput } from "@/lib/pricing/import-model-cost-profile-versioned";

export const FINTECH_PRICING_SOURCE = "fintech-ai 报价单0818";

/** 第三方代付报价在 ModelCostProfile.vendor 的统一 code */
export const FINTECH_COST_VENDOR = "fintech";

function wrapFintechCostRow(
  mapped: MappedRow,
  noteTail: string,
  discountRate: number,
): ImportModelCostProfileInput {
  const cloudVendor = mapped.vendor;
  return {
    ...mapped,
    vendor: FINTECH_COST_VENDOR,
    channel: "RESELLER",
    discountRate,
    note: `${FINTECH_PRICING_SOURCE} · 云厂商=${cloudVendor} · ${noteTail}`,
  };
}

/** Fintech「模型厂商」→ 平台 vendor code */
export const FINTECH_VENDOR_LABEL_TO_CODE: Record<string, string> = {
  腾讯混元: "tencent",
  deepseek: "deepseek",
  Deepseek: "deepseek",
  智谱清言: "zhipu",
  月之暗面: "moonshot",
  "minimax稀宇": "minimax",
  "MiniMax稀宇": "minimax",
  阿里云百练: "aliyun",
  volcengine: "volcengine",
  "Volcengine‌": "volcengine",
  生数科技: "aliyun",
  kling: "aliyun",
  Kling: "aliyun",
};

export type FintechParseResult = {
  rows: ImportModelCostProfileInput[];
  skipped: Array<{ reason: string; raw: string }>;
};

type RawRow = [string, string, string | number, string | number, string | number, string, number];

function num(v: unknown): number | null {
  if (v == null || v === "" || v === "/") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function norm(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function parseUnit(raw: string): CreditCostUnit | null {
  const u = raw.trim();
  if (u.includes("元/1秒") || u.includes("元/秒")) return "PER_SEC";
  if (u.includes("元/张")) return "PER_IMAGE";
  if (u.includes("元/百万token") || u.includes("元/百万 tokens")) return "PER_KTOKEN";
  return null;
}

/** Fintech 折扣列：实付 = 挂牌 × multiplier → discountRate = 1 − multiplier */
export function fintechMultiplierToDiscountRate(multiplier: number): number {
  const m = Math.min(Math.max(multiplier, 0), 1.5);
  return Math.round(Math.max(0, Math.min(1, 1 - m)) * 10000) / 10000;
}

function tierFromSpec(spec: string, listYuan: number | null): string | null {
  const s = spec.toLowerCase();
  if (/1080|1\.0\s*元/.test(s) || listYuan === 1 || listYuan === 1.6) return "1080P";
  if (/720|0\.6\s*元/.test(s) || listYuan === 0.6) return "720P";
  if (/480|540/.test(s)) return "480P";
  if (/4k|4K/.test(s)) return "4K";
  if (/360/.test(s)) return "360P";
  if (listYuan === 0.9) return "720P";
  if (listYuan === 1.6) return "1080P";
  return null;
}

type MappedRow = Omit<ImportModelCostProfileInput, "channel" | "note">;

function mapVideoImageRow(input: {
  vendorLabel: string;
  modelName: string;
  spec: string;
  listYuan: number;
  unit: CreditCostUnit;
  inputYuan?: number | null;
  outputYuan?: number | null;
}): MappedRow | null {
  const vendor = FINTECH_VENDOR_LABEL_TO_CODE[input.vendorLabel.trim()];
  if (!vendor) return null;

  const name = norm(input.modelName);
  const spec = norm(String(input.spec ?? ""));
  const tier = tierFromSpec(spec, input.listYuan);
  const n = name.toLowerCase();

  // —— 视频 · 元/秒 ——
  if (input.unit === "PER_SEC") {
    if (/happyhorse-1\.0-t2v/i.test(name)) {
      return {
        vendor,
        canonicalModelKey: "happyhorse-1.0-t2v",
        unit: "PER_SEC",
        tierRaw: tier ?? (input.listYuan >= 1 ? "1080P" : "720P"),
        listCostYuan: input.listYuan,
      };
    }
    if (/happyhorse-1\.0-r2v/i.test(name)) {
      return {
        vendor,
        canonicalModelKey: "happyhorse-r2v",
        unit: "PER_SEC",
        tierRaw: tier ?? (input.listYuan >= 1 ? "1080P" : "720P"),
        listCostYuan: input.listYuan,
      };
    }
    if (/happyhorse-1\.0-i2v/i.test(name)) {
      return {
        vendor,
        canonicalModelKey: "happyhorse-1.0-i2v",
        unit: "PER_SEC",
        tierRaw: tier ?? (input.listYuan >= 1 ? "1080P" : "720P"),
        listCostYuan: input.listYuan,
      };
    }
    if (/万相2\.7-文生视频|万相2\.7-图生视频|万相2\.7-多模态|万相2\.7-视频编辑/i.test(name)) {
      return {
        vendor,
        canonicalModelKey: "wanxiang-video-2.7",
        unit: "PER_SEC",
        tierRaw: tier ?? (input.listYuan >= 1 ? "1080P" : "720P"),
        listCostYuan: input.listYuan,
      };
    }
    if (/万相2\.6-文生视频|万相2\.6-图生视频|通义万相2\.6-图生视频-flash/i.test(name)) {
      return {
        vendor,
        canonicalModelKey: "wanxiang-video-2.6",
        unit: "PER_SEC",
        tierRaw: tier ?? (input.listYuan >= 0.5 ? "1080P" : "720P"),
        listCostYuan: input.listYuan,
      };
    }
    if (/kling-v3/i.test(name)) {
      if (!spec && input.listYuan >= 2) return null;
      if (/4k|4K/.test(spec) && input.listYuan >= 2) {
        return {
          vendor: "aliyun",
          canonicalModelKey: "kling-3.0-video",
          unit: "PER_SEC",
          tierRaw: "4K",
          listCostYuan: input.listYuan,
        };
      }
      if (input.listYuan > 1.5) return null;
      return {
        vendor: "aliyun",
        canonicalModelKey: "kling-3.0-video",
        unit: "PER_SEC",
        tierRaw: tier ?? "720P",
        listCostYuan: input.listYuan,
      };
    }
    if (/seedance-2\.0/i.test(name) && /720p.*不包含视频输入|720p/i.test(spec)) {
      // 46 元/百万 token ≈ 1 元/秒@15s（火山官方口径）；Fintech 按 token 计价时折算为 PER_SEC 挂牌
      const list =
        input.listYuan > 10 ? 46 / 46 : input.listYuan;
      return {
        vendor: "volcengine",
        canonicalModelKey: "seedance-2.0",
        unit: "PER_SEC",
        tierRaw: "720P",
        listCostYuan: list,
      };
    }
    if (/seedance-2\.0/i.test(name) && input.listYuan <= 30) {
      return {
        vendor: "volcengine",
        canonicalModelKey: "seedance-2.0",
        unit: "PER_SEC",
        tierRaw: tier ?? "720P",
        listCostYuan: input.listYuan,
      };
    }
  }

  // —— 生图 · 元/张 ——
  if (input.unit === "PER_IMAGE") {
    if (/万相2\.7 image pro/i.test(name)) {
      return { vendor, canonicalModelKey: "wan2.7-image-pro", unit: "PER_IMAGE", listCostYuan: input.listYuan };
    }
    if (/万相2\.7 image/i.test(name)) {
      return { vendor, canonicalModelKey: "wan2.7-image", unit: "PER_IMAGE", listCostYuan: input.listYuan };
    }
    if (/qwen-image-edit-max/i.test(name)) {
      return { vendor, canonicalModelKey: "qwen-image-edit-max", unit: "PER_IMAGE", listCostYuan: input.listYuan };
    }
    if (/qwen-image-edit-plus|qwen-image-edit/i.test(name)) {
      return { vendor, canonicalModelKey: "qwen-image-edit", unit: "PER_IMAGE", listCostYuan: input.listYuan };
    }
  }

  // —— LLM · 元/百万 token ——
  if (input.unit === "PER_KTOKEN") {
    const inM = input.inputYuan ?? input.listYuan;
    const outM = input.outputYuan ?? inM;
    if (inM == null) return null;
    const inK = inM / 1000;
    const outK = outM != null ? outM / 1000 : inK;

    if (/deepseek-v4-flash/i.test(name)) {
      return {
        vendor: "deepseek",
        canonicalModelKey: "deepseek-chat",
        unit: "PER_KTOKEN",
        listCostYuan: inK,
        inputListCostYuan: inK,
        outputListCostYuan: outK,
      };
    }
    if (/kimi k2\.6/i.test(name)) {
      return {
        vendor: "aliyun",
        canonicalModelKey: "kimi-k2.6",
        unit: "PER_KTOKEN",
        listCostYuan: inK,
        inputListCostYuan: inK,
        outputListCostYuan: outK,
      };
    }
    if (/qwen3\.8-max|qwen3\.7-max/i.test(name)) {
      return {
        vendor,
        canonicalModelKey: "qwen3.8-max",
        unit: "PER_KTOKEN",
        listCostYuan: inK,
        inputListCostYuan: inK,
        outputListCostYuan: outK,
      };
    }
  }

  return null;
}

function parseDomesticRow(row: RawRow): ImportModelCostProfileInput | { skip: string } | null {
  const vendorLabel = String(row[0] ?? "").trim();
  const modelName = String(row[1] ?? "").trim();
  if (!vendorLabel || !modelName || vendorLabel === "模型厂商") return null;

  const unit = parseUnit(String(row[5] ?? ""));
  if (!unit) return { skip: `未知计价单位: ${row[5]}` };

  const discountMult = num(row[6]) ?? 1;
  const discountRate = fintechMultiplierToDiscountRate(discountMult);

  const c3 = row[2];
  const c4 = row[3];
  const c5 = row[4];

  if (unit === "PER_KTOKEN") {
    const specStr = typeof c3 === "string" ? c3 : "";
    const inputM = num(c3) ?? num(c4);
    const outputM = num(c4);
    if (/seedance-2\.0/i.test(modelName)) {
      if (/720p.*不包含视频输入/i.test(specStr) && num(c4) != null) {
        return wrapFintechCostRow(
          {
            vendor: "volcengine",
            canonicalModelKey: "seedance-2.0",
            unit: "PER_SEC",
            tierRaw: "720P",
            listCostYuan: 1,
          },
          `Seedance 720P token→¥1/s · ${specStr}`,
          discountRate,
        );
      }
      return { skip: `Seedance token 行未折算: ${modelName}` };
    }
    if (inputM == null && outputM == null) return { skip: "LLM 行缺少 in/out 价格" };
    const mapped = mapVideoImageRow({
      vendorLabel,
      modelName,
      spec: "",
      listYuan: inputM ?? outputM ?? 0,
      unit,
      inputYuan: inputM,
      outputYuan: outputM,
    });
    if (!mapped) return { skip: `未映射 LLM: ${vendorLabel} · ${modelName}` };
    return wrapFintechCostRow(mapped, modelName, discountRate);
  }

  const specStr = typeof c3 === "string" ? c3 : "";
  const listFromC4 = num(c4);
  const listFromC3 = num(c3);
  const listYuan = listFromC4 ?? listFromC3;
  if (listYuan == null || listYuan <= 0) return { skip: "缺少挂牌价" };

  const mapped = mapVideoImageRow({
    vendorLabel,
    modelName,
    spec: specStr,
    listYuan,
    unit,
  });
  if (!mapped) return { skip: `未映射: ${vendorLabel} · ${modelName} · ${specStr || listYuan}` };

  return wrapFintechCostRow(
    mapped,
    `${modelName}${specStr ? ` · ${specStr}` : ""}`,
    discountRate,
  );
}

/** 读取 xlsx「国内模型」sheet 并映射为可导入行（去重：同 vendor+canonical+tier 保留最后一行）。 */
export function parseFintechPricingXlsx(buffer: Buffer): FintechParseResult {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheetName = wb.SheetNames.find((n) => n.includes("国内")) ?? wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  if (!ws) {
    return { rows: [], skipped: [{ reason: "无工作表", raw: "" }] };
  }

  const matrix = XLSX.utils.sheet_to_json<RawRow>(ws, { header: 1, defval: "" }) as RawRow[];
  const skipped: FintechParseResult["skipped"] = [];
  const byKey = new Map<string, ImportModelCostProfileInput>();

  for (let i = 2; i < matrix.length; i++) {
    const row = matrix[i];
    if (!row || !row[0]) continue;
    const parsed = parseDomesticRow(row);
    if (!parsed) continue;
    if ("skip" in parsed) {
      skipped.push({ reason: parsed.skip, raw: JSON.stringify(row) });
      continue;
    }
    const key = `${parsed.canonicalModelKey}|${parsed.tierRaw ?? ""}|${parsed.unit}`;
    byKey.set(key, parsed);
  }

  return { rows: [...byKey.values()], skipped };
}
