import { NextResponse } from "next/server";

import { generateDetailPageSuiteImages } from "@/lib/ecom/detail-page-suite/image-gen";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

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
    /* empty */
  }
  try {
    const slotKeys = Array.isArray(body.slotKeys)
      ? body.slotKeys.filter((k): k is string => typeof k === "string")
      : undefined;
    const imageRatio =
      body.imageRatio === "1:1" ||
      body.imageRatio === "3:4" ||
      body.imageRatio === "4:5" ||
      body.imageRatio === "16:9"
        ? body.imageRatio
        : undefined;
    const result = await generateDetailPageSuiteImages({
      userId: auth.userId,
      projectId: id,
      moduleId: typeof body.moduleId === "string" ? body.moduleId : undefined,
      slotKey: typeof body.slotKey === "string" ? body.slotKey : undefined,
      slotKeys,
      onlySelected: body.onlySelected === true,
      modelKey: typeof body.modelKey === "string" ? body.modelKey : undefined,
      imageSize: typeof body.imageSize === "string" ? body.imageSize : undefined,
      imageRatio,
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "生图失败" },
      { status: 400 },
    );
  }
}
