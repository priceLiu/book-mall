"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { createHash } from "crypto";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  analyzeCsvHeader,
  parseCanonicalPricingCsv,
  rewriteCsvToCanonicalOrder,
  type HeaderAnalysis,
} from "@/lib/pricing/canonical-csv";
import {
  createPricingVersionAndSetCurrent,
  loadCurrentPricingDrafts,
  mergeCsvImportIntoCurrent,
} from "@/lib/pricing/pricing-import-service";

export type AnalyzePreview = {
  ok: true;
  header: HeaderAnalysis;
  rowCount: number;
  sampleRows: string[][]; // 最多 8 行（裁短）
  canonicalCsv: string | null; // 头部可全部对齐时给出规范 CSV，否则 null
  parseError?: string;
};

export type AnalyzeResult = AnalyzePreview | { ok: false; error: string };

/** 仅做分析；不入库。返回规范 CSV（若识别到所有规范列）+ 解析能否通过。 */
export async function analyzeUploadAction(
  formData: FormData,
): Promise<AnalyzeResult> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return { ok: false, error: "需要管理员登录" };
  }
  const csv = (formData.get("csv") as string | null)?.toString() ?? "";
  if (!csv.trim()) return { ok: false, error: "CSV 内容为空" };
  const aliasesRaw = (formData.get("aliases") as string | null)?.toString() ?? "";
  const extra = parseAliasesJsonSafe(aliasesRaw);

  const analyze = analyzeCsvHeader(csv, extra);
  if (!analyze.ok) return { ok: false, error: analyze.error };

  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const sampleRows = lines.slice(1, 9).map((l) => l.split(",").map((c) => c.trim()));

  // 若全部规范列已被覆盖，尝试给出转换后的 CSV
  let canonicalCsv: string | null = null;
  let parseError: string | undefined;
  if (analyze.report.missingCanonical.length === 0) {
    const rewrite = rewriteCsvToCanonicalOrder(csv, extra);
    if (rewrite.ok) {
      canonicalCsv = rewrite.out;
      // 同时跑一遍解析，捕获行级错误
      const parsed = parseCanonicalPricingCsv(canonicalCsv, extra);
      if (!parsed.ok) parseError = parsed.error;
    } else {
      parseError = rewrite.error;
    }
  }

  return {
    ok: true,
    header: analyze.report,
    rowCount: Math.max(0, lines.length - 1),
    sampleRows,
    canonicalCsv,
    parseError,
  };
}

/** 真正导入并设为当前版本（不可逆 — 调用者须二次确认）。 */
export async function importUploadAction(formData: FormData): Promise<
  | { ok: true; versionId: string; rowCount: number }
  | { ok: false; error: string }
> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return { ok: false, error: "需要管理员登录" };
  }
  const csv = (formData.get("csv") as string | null)?.toString() ?? "";
  if (!csv.trim()) return { ok: false, error: "CSV 内容为空" };
  const aliasesRaw = (formData.get("aliases") as string | null)?.toString() ?? "";
  const extra = parseAliasesJsonSafe(aliasesRaw);
  const vendorKind = (formData.get("vendorKind") as string | null)?.toString().trim() || "csv";
  const label = (formData.get("label") as string | null)?.toString().trim() || `upload:${vendorKind}`;
  const confirmedTwice = formData.get("confirm") === "yes" && formData.get("confirm2") === "yes";
  if (!confirmedTwice) {
    return { ok: false, error: "未通过二次确认" };
  }

  const parsed = parseCanonicalPricingCsv(csv, extra);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const prev = await loadCurrentPricingDrafts(prisma);
  const merged =
    prev.length === 0
      ? parsed.rows
      : mergeCsvImportIntoCurrent(prev, parsed.rows);

  const sha = createHash("sha256").update(Buffer.from(csv, "utf8")).digest("hex");

  try {
    const { versionId } = await createPricingVersionAndSetCurrent(prisma, {
      kind: vendorKind,
      sourceSha256: sha,
      label,
      importedByUserId: session.user.id,
      lines: merged,
    });
    revalidatePath("/admin/finance/cloud-pricing");
    return { ok: true, versionId, rowCount: merged.length };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "导入失败（未知错误）",
    };
  }
}

function parseAliasesJsonSafe(raw: string): Record<string, string> | undefined {
  if (!raw.trim()) return undefined;
  try {
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== "object" || Array.isArray(v)) return undefined;
    const out: Record<string, string> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (typeof k === "string" && typeof val === "string") {
        out[k] = val;
      }
    }
    return Object.keys(out).length ? out : undefined;
  } catch {
    return undefined;
  }
}
