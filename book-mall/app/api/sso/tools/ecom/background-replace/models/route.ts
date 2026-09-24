import { NextResponse } from "next/server";

import { loadBackgroundReplaceModels } from "@/lib/ecom/ecom-background-replace-models";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return auth.res;

  try {
    const data = await loadBackgroundReplaceModels(auth.userId);
    return NextResponse.json(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "加载换背景模型失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
