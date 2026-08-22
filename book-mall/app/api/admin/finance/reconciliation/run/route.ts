import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canViewFinanceCost } from "@/lib/auth/permissions";
import { financeCorsHeaders } from "@/lib/finance/cors";
import { runReconciliationFromCsv } from "@/lib/finance/reconciliation-run";
import { runAliyunReconciliationV2 } from "@/lib/finance/reconciliation-v2/run-aliyun-reconciliation";
import { runDeepseekReconciliationV2 } from "@/lib/finance/reconciliation-v2/run-deepseek-reconciliation";
import { runKieReconciliationV2 } from "@/lib/finance/reconciliation-v2/run-kie-reconciliation";
import {
  isSupportedVendorBillFilename,
  readVendorBillFileToCsvText,
  type VendorBillFormat,
} from "@/lib/finance/reconciliation-v2/vendor-bill-file";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: financeCorsHeaders(request) });
}

/**
 * 上传云厂商账单（CSV / TSV / Excel）→ 自动校验、对账、更新总表。
 * multipart/form-data：字段 `csv` 或 `bill`（File）。
 */
export async function POST(request: NextRequest) {
  const cors = financeCorsHeaders(request);
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !canViewFinanceCost(session.user.role)) {
    return NextResponse.json({ error: "需要财务管理员权限" }, { status: 403, headers: cors });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "请使用 multipart/form-data" }, { status: 400, headers: cors });
  }
  const file = (form.get("csv") ?? form.get("bill")) as File | null;
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "缺少账单文件字段（csv 或 bill）" },
      { status: 400, headers: cors },
    );
  }
  if (file.size === 0 || file.size > 30 * 1024 * 1024) {
    return NextResponse.json({ error: "文件为空或大于 30MB" }, { status: 413, headers: cors });
  }
  const filename = file.name || "uploaded.csv";
  if (!isSupportedVendorBillFilename(filename)) {
    return NextResponse.json(
      { error: "不支持的文件格式，请上传 CSV、TSV 或 Excel（.xls / .xlsx）" },
      { status: 400, headers: cors },
    );
  }

  const rejectDup = form.get("force") === "1";
  const engine = String(form.get("engine") ?? "v2").trim();
  const vendor = String(form.get("vendor") ?? "aliyun").trim() as VendorBillFormat;
  const priceMode = String(form.get("priceMode") ?? "list").trim() as "list" | "payable";

  const file2 = form.get("bill2") as File | null;

  let csvText: string;
  let extraCsvText: string | undefined;
  let billFormat: VendorBillFormat;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await readVendorBillFileToCsvText({
      buffer,
      filename,
      vendor:
        vendor === "aliyun" || vendor === "kie" || vendor === "deepseek" ? vendor : undefined,
    });
    csvText = parsed.csvText;
    billFormat = parsed.format;

    if (file2 instanceof File && file2.size > 0) {
      const buffer2 = Buffer.from(await file2.arrayBuffer());
      const parsed2 = await readVendorBillFileToCsvText({
        buffer: buffer2,
        filename: file2.name || "uploaded-2.csv",
        vendor: billFormat === "deepseek" ? "deepseek" : undefined,
      });
      if (parsed2.format !== "deepseek" && billFormat === "deepseek") {
        throw new Error("第二文件须为 DeepSeek cost 或 amount CSV");
      }
      extraCsvText = parsed2.csvText;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400, headers: cors });
  }

  const periodFrom = String(form.get("periodFrom") ?? "").trim();
  const periodTo = String(form.get("periodTo") ?? "").trim();
  const period =
    periodFrom && periodTo ? ({ from: periodFrom, to: periodTo } as const) : undefined;

  try {
    if (engine === "v2" && billFormat === "aliyun") {
      const result = await runAliyunReconciliationV2({
        csvText,
        csvFilename: filename,
        importedByUserId: session.user.id,
        rejectDuplicate: rejectDup,
        priceMode,
        period,
      });
      return NextResponse.json(result, { headers: cors });
    }

    if (engine === "v2" && billFormat === "kie") {
      const result = await runKieReconciliationV2({
        csvText,
        csvFilename: filename,
        importedByUserId: session.user.id,
        rejectDuplicate: rejectDup,
        priceMode,
        period,
      });
      return NextResponse.json(result, { headers: cors });
    }

    if (engine === "v2" && billFormat === "deepseek") {
      const result = await runDeepseekReconciliationV2({
        csvText,
        extraCsvText,
        csvFilename: filename,
        importedByUserId: session.user.id,
        rejectDuplicate: rejectDup,
        priceMode,
        period,
      });
      return NextResponse.json(result, { headers: cors });
    }

    const result = await runReconciliationFromCsv({
      csvText,
      csvFilename: filename,
      importedByUserId: session.user.id,
      rejectDuplicate: rejectDup,
    });
    return NextResponse.json(result, { headers: cors });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400, headers: cors });
  }
}
