import { NextResponse } from "next/server";

import { loadEcomStoryboardGatewayModels } from "@/lib/ecom/ecom-storyboard-models-loader";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const payload = await loadEcomStoryboardGatewayModels(auth.userId);
  const res = NextResponse.json(payload);
  res.headers.set("Cache-Control", "private, max-age=0, stale-while-revalidate=300");
  return res;
}
