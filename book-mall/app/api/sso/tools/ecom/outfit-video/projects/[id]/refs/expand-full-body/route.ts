import { NextResponse } from "next/server";

import { expandEcomOutfitVideoModelFullBody } from "@/lib/ecom/ecom-outfit-video-service";
import { formatEcomImageGenUserError } from "@/lib/ecom/ecom-image-processing-error";
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
    /* */
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : undefined;
  const modelKey = typeof body.modelKey === "string" ? body.modelKey.trim() : undefined;

  try {
    const project = await expandEcomOutfitVideoModelFullBody(auth.userId, id, {
      prompt,
      modelKey,
    });
    return NextResponse.json({ project });
  } catch (e) {
    const { message, status } = formatEcomImageGenUserError(e);
    return NextResponse.json({ error: message }, { status });
  }
}
