import { NextResponse } from "next/server";

import { generateEcomVtonTextTryonImage } from "@/lib/ecom/ecom-vton-text-tryon";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const ratioRaw = typeof body.ratio === "string" ? body.ratio.trim() : "";
  const ratio =
    ratioRaw === "4:5" || ratioRaw === "1:1" || ratioRaw === "3:4"
      ? ratioRaw
      : undefined;

  try {
    const project = await generateEcomVtonTextTryonImage(auth.userId, id, {
      prompt: typeof body.prompt === "string" ? body.prompt : undefined,
      modelKey: typeof body.modelKey === "string" ? body.modelKey : undefined,
      ratio,
    });
    return NextResponse.json({ project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "生成失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
