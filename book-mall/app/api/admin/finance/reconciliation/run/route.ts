import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { financeCorsHeaders } from "@/lib/finance/cors";
import { runReconciliationFromCsv } from "@/lib/finance/reconciliation-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: financeCorsHeaders(request) });
}

/**
 * v002 P5：上传云厂商账单 CSV → 自动校验、入库为一次「对账批次」。
 * - 仅管理员可用。
 * - multipart/form-data，字段 `csv`（File）、可选 `force=1`（强制重新对账即使 SHA-256 已存在则报错）。
 */
export async function POST(request: NextRequest) {
  const cors = financeCorsHeaders(request);
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "需要管理员" }, { status: 403, headers: cors });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "请使用 multipart/form-data" }, { status: 400, headers: cors });
  }
  const file = form.get("csv");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "缺少 csv 文件字段" }, { status: 400, headers: cors });
  }
  if (file.size === 0 || file.size > 30 * 1024 * 1024) {
    return NextResponse.json({ error: "CSV 文件为空或大于 30MB" }, { status: 413, headers: cors });
  }
  const rejectDup = form.get("force") === "1";
  const csvText = await file.text();
  if (!csvText.includes("标识信息/账单明细ID")) {
    return NextResponse.json(
      { error: "CSV 表头不包含 `标识信息/账单明细ID`，疑似非阿里云 consumedetailbill v2 格式" },
      { status: 400, headers: cors },
    );
  }

  try {
    const result = await runReconciliationFromCsv({
      csvText,
      csvFilename: file.name || "uploaded.csv",
      importedByUserId: session.user.id,
      rejectDuplicate: rejectDup,
    });
    return NextResponse.json(result, { headers: cors });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400, headers: cors });
  }
}
