import { NextRequest } from "next/server";

import { canManagePricing } from "@/lib/auth/permissions";
import {
  financeForbidden,
  financeJson,
  financeOptions,
  financeUnauthorized,
  getFinanceSession,
} from "@/lib/finance/finance-api";
import { recordVipDocument } from "@/lib/finance/vip-ops-service";
import { uploadVipDealDocument } from "@/lib/finance/vip-document-upload";
import type { VipDealDocumentKind } from "@prisma/client";

export async function OPTIONS(request: NextRequest) {
  return financeOptions(request);
}

const KINDS = new Set<string>(["CONTRACT", "PAYMENT_PROOF", "INVOICE", "OTHER"]);

export async function POST(request: NextRequest) {
  const user = await getFinanceSession();
  if (!user) return financeUnauthorized(request);
  if (!canManagePricing(user.role)) {
    return financeForbidden(request, "仅财务管理员可上传");
  }

  const ct = request.headers.get("content-type") ?? "";
  if (!ct.includes("multipart/form-data")) {
    return financeJson(request, { error: "需要 multipart/form-data" }, { status: 400 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return financeJson(request, { error: "无法解析表单" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return financeJson(request, { error: "缺少 file 字段" }, { status: 400 });
  }

  const kindRaw = String(form.get("kind") ?? "OTHER").trim().toUpperCase();
  const kind = (KINDS.has(kindRaw) ? kindRaw : "OTHER") as VipDealDocumentKind;
  const tenantId = String(form.get("tenantId") ?? "").trim() || null;
  const ownerUserId = String(form.get("ownerUserId") ?? "").trim() || null;
  const note = String(form.get("note") ?? "").trim() || null;

  if (!tenantId && !ownerUserId) {
    return financeJson(request, { error: "请指定 tenantId 或 ownerUserId" }, { status: 400 });
  }

  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const uploaded = await uploadVipDealDocument({
      buf,
      filename: file.name || "document",
      mimeType: file.type || "application/octet-stream",
      tenantId,
      ownerUserId,
      kind,
    });

    const doc = await recordVipDocument({
      tenantId,
      ownerUserId,
      kind,
      ossUrl: uploaded.ossUrl,
      filename: file.name || "document",
      mimeType: file.type || null,
      fileSizeBytes: buf.byteLength,
      note,
      uploadedByUserId: user.id,
    });

    return financeJson(request, {
      ok: true,
      document: { ...doc, createdAt: doc.createdAt.toISOString() },
    });
  } catch (e) {
    return financeJson(request, { error: (e as Error).message }, { status: 400 });
  }
}
