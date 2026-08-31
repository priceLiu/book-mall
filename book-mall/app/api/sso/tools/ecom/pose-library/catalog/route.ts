import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { readPoseLibraryCatalogLive } from "@/lib/ecom/ecom-pose-library-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return auth.res;
  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const catalog = await readPoseLibraryCatalogLive();
    return NextResponse.json(catalog);
  } catch (e) {
    const message = e instanceof Error ? e.message : "加载失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
