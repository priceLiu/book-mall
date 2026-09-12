import { NextResponse } from "next/server";

import { refineEcomModelTryonResult } from "@/lib/ecom/ecom-model-tryon-service";
import type { VtonTryonRefinerGender } from "@/lib/ecom/ecom-vton/types";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

function parseGender(raw: unknown): VtonTryonRefinerGender | null {
  if (raw === "woman" || raw === "man") return raw;
  return null;
}

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;

  let body: { resultId?: string; gender?: unknown } = {};
  try {
    const text = await req.text();
    if (text.trim()) body = JSON.parse(text) as typeof body;
  } catch {
    return NextResponse.json({ error: "无效 JSON" }, { status: 400 });
  }

  const resultId = typeof body.resultId === "string" ? body.resultId.trim() : "";
  const gender = parseGender(body.gender);
  if (!resultId) {
    return NextResponse.json({ error: "缺少 resultId" }, { status: 400 });
  }
  if (!gender) {
    return NextResponse.json({ error: "gender 须为 woman 或 man" }, { status: 400 });
  }

  try {
    const project = await refineEcomModelTryonResult(auth.userId, id, { resultId, gender });
    return NextResponse.json({ project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "试衣精修失败";
    const status =
      message.includes("请先") ||
      message.includes("尚无") ||
      message.includes("进行中") ||
      message.includes("仅成功") ||
      message.includes("不存在") ||
      message.includes("缺少")
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
