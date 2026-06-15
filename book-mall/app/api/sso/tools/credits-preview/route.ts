import { NextResponse } from "next/server";

import { previewModelCredits } from "@/lib/billing/model-credits-preview";
import { getUserBillingPersona } from "@/lib/billing/billing-persona";
import { requireToolsJwtSecret } from "@/lib/sso-tools-env";
import { verifyToolsAccessToken } from "@/lib/tools-sso-token";

export const dynamic = "force-dynamic";

/** 工具站 SSO：积分计价预览（替代 scheme-a billable-hint）。 */
export async function GET(req: Request) {
  let jwtSecret: string;
  try {
    jwtSecret = requireToolsJwtSecret();
  } catch {
    return NextResponse.json({ error: "JWT 密钥未配置" }, { status: 503 });
  }

  const auth = req.headers.get("authorization");
  const raw = auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";
  if (!raw) return NextResponse.json({ error: "缺少 Bearer Token" }, { status: 401 });

  const verified = verifyToolsAccessToken(raw, jwtSecret);
  if (!verified) return NextResponse.json({ error: "无效或过期的工具令牌" }, { status: 401 });

  const url = new URL(req.url);
  const modelKey = url.searchParams.get("modelKey")?.trim() ?? "";
  if (!modelKey) return NextResponse.json({ error: "modelKey 必填" }, { status: 400 });

  const durationRaw = url.searchParams.get("durationSec");
  const imageRaw = url.searchParams.get("imageCount");
  const variantId = url.searchParams.get("variantId")?.trim() || null;
  const canonicalModelKey = url.searchParams.get("canonicalModelKey")?.trim() || null;
  const resolution = url.searchParams.get("resolution")?.trim() || null;

  const persona = await getUserBillingPersona(verified.sub);

  const billingOwner =
    verified.tenant_type === "TEAM" && verified.tenant_id
      ? ({ ownerType: "TENANT", ownerId: verified.tenant_id } as const)
      : ({ ownerType: "USER", ownerId: verified.sub } as const);

  const preview = await previewModelCredits({
    modelKey,
    variantId,
    canonicalModelKey,
    ownerType: billingOwner.ownerType,
    ownerId: billingOwner.ownerId,
    durationSec: durationRaw ? Number(durationRaw) : null,
    imageCount: imageRaw ? Number(imageRaw) : null,
    resolution,
  });

  if (!preview) {
    return NextResponse.json({ error: "模型报价未配置" }, { status: 404 });
  }

  return NextResponse.json({
    scheme: persona === "BYOK" ? "byok" : "unified_credits",
    billingPersona: persona ?? "PLATFORM_CREDIT",
    credits: preview.estimatedCredits,
    creditsPerUnit: preview.creditsPerUnit,
    pricePerCreditYuan: preview.pricePerCreditYuan,
    estimatedYuan: Math.round(preview.estimatedCredits * preview.pricePerCreditYuan * 100) / 100,
    canonicalModelKey: preview.canonicalModelKey,
    unit: preview.unit,
  });
}
