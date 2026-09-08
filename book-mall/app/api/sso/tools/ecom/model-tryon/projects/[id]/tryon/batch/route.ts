import { NextResponse } from "next/server";

import { runEcomModelTryonBatch } from "@/lib/ecom/ecom-model-tryon-service";
import type { VtonLookSpec } from "@/lib/ecom/ecom-vton/types";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;

  let body: { looks?: VtonLookSpec[] } = {};
  try {
    const text = await req.text();
    if (text.trim()) body = JSON.parse(text) as typeof body;
  } catch {
    return NextResponse.json({ error: "无效 JSON" }, { status: 400 });
  }

  try {
    const project = await runEcomModelTryonBatch(auth.userId, id, {
      looks: body.looks,
    });
    return NextResponse.json({ project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "批量试衣失败";
    const status =
      message.includes("请先") || message.includes("至少") || message.includes("最多")
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
