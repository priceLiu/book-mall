import { NextResponse } from "next/server";

import { previewModelCredits } from "@/lib/billing/model-credits-preview";
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

  const preview = await previewModelCredits({
    modelKey,
    ownerType: "USER",
    ownerId: verified.sub,
    durationSec: durationRaw ? Number(durationRaw) : null,
    imageCount: imageRaw ? Number(imageRaw) : null,
  });

  if (!preview) {
    return NextResponse.json({ error: "模型报价未配置" }, { status: 404 });
  }

  return NextResponse.json({
    scheme: "unified_credits",
    credits: preview.estimatedCredits,
    creditsPerUnit: preview.creditsPerUnit,
    pricePerCreditYuan: preview.pricePerCreditYuan,
    estimatedYuan: Math.round(preview.estimatedCredits * preview.pricePerCreditYuan * 100) / 100,
    canonicalModelKey: preview.canonicalModelKey,
    unit: preview.unit,
  });
}
