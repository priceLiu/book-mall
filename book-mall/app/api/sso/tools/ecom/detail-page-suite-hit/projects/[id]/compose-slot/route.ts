import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { composeDetailPageSuiteHitSlotCopy } from "@/lib/ecom/detail-page-suite/slot-copy-compose-service";
import type { DetailPageSuiteCopyOverlay } from "@/lib/ecom/detail-page-suite/slot-copy-overlay-types";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "无权限" }, { status: 403 });
  }
  const { id: projectId } = await ctx.params;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const moduleId = String(body.moduleId ?? "").trim();
  const slotKey = String(body.slotKey ?? "").trim();
  const baseImageUrl = String(body.baseImageUrl ?? "").trim();
  if (!moduleId || !slotKey || !baseImageUrl) {
    return NextResponse.json({ error: "缺少 moduleId / slotKey / baseImageUrl" }, { status: 400 });
  }
  const overlay = body.overlay as DetailPageSuiteCopyOverlay;
  if (!overlay || overlay.version !== 1) {
    return NextResponse.json({ error: "overlay 无效" }, { status: 400 });
  }
  const slotCopy = typeof body.slotCopy === "string" ? body.slotCopy : undefined;
  try {
    const result = await composeDetailPageSuiteHitSlotCopy({
      userId: auth.userId,
      projectId,
      moduleId,
      slotKey,
      baseImageUrl,
      overlay,
      slotCopy,
    });
    return NextResponse.json({ url: result.url, project: result.project });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "合成失败" },
      { status: 400 },
    );
  }
}
