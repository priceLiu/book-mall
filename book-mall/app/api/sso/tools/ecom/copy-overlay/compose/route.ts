import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { composeEcomCopyOverlayImage } from "@/lib/ecom/copy-overlay/compose-image";
import type { EcomCopyOverlay } from "@private/ecom-copy-overlay";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "无权限" }, { status: 403 });
  }
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const baseImageUrl = String(body.baseImageUrl ?? "").trim();
  const overlay = body.overlay as EcomCopyOverlay;
  if (!baseImageUrl || !overlay || overlay.version !== 1) {
    return NextResponse.json({ error: "缺少 baseImageUrl 或 overlay" }, { status: 400 });
  }
  const syncText = typeof body.syncText === "string" ? body.syncText : undefined;
  const exportWidthPx =
    typeof body.exportWidthPx === "number" ? Math.round(body.exportWidthPx) : undefined;
  try {
    const result = await composeEcomCopyOverlayImage({
      userId: auth.userId,
      baseImageUrl,
      overlay,
      syncText,
      exportWidthPx,
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "合成失败" },
      { status: 400 },
    );
  }
}
