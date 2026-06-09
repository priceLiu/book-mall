import { NextRequest } from "next/server";

import { previewModelCredits } from "@/lib/billing/model-credits-preview";
import {
  financeJson,
  financeOptions,
  financeUnauthorized,
  getFinanceSession,
} from "@/lib/finance/finance-api";

export async function OPTIONS(request: NextRequest) {
  return financeOptions(request);
}

/** GET ?modelKey=&durationSec=&imageCount=&ownerType=&ownerId= */
export async function GET(request: NextRequest) {
  const user = await getFinanceSession();
  if (!user) return financeUnauthorized(request);

  const url = new URL(request.url);
  const modelKey = url.searchParams.get("modelKey")?.trim() ?? "";
  if (!modelKey) {
    return financeJson(request, { ok: false, error: "modelKey 必填" }, { status: 400 });
  }

  const durationRaw = url.searchParams.get("durationSec");
  const imageRaw = url.searchParams.get("imageCount");
  const ownerType = url.searchParams.get("ownerType") as "USER" | "TENANT" | null;
  const ownerId = url.searchParams.get("ownerId")?.trim() ?? undefined;

  const preview = await previewModelCredits({
    modelKey,
    ownerType: ownerType === "TENANT" || ownerType === "USER" ? ownerType : "USER",
    ownerId: ownerId ?? user.id,
    durationSec: durationRaw ? Number(durationRaw) : null,
    imageCount: imageRaw ? Number(imageRaw) : null,
  });

  if (!preview) {
    return financeJson(request, { ok: false, error: "模型报价未配置" }, { status: 404 });
  }

  return financeJson(request, { ok: true, ...preview });
}
