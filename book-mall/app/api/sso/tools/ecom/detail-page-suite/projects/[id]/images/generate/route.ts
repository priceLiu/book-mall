import { NextResponse } from "next/server";

import { reconcileDetailPageSuiteProjectFromAssets } from "@/lib/ecom/detail-page-suite/asset-reconcile";
import { generateDetailPageSuiteImages } from "@/lib/ecom/detail-page-suite/image-gen";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";
/** 多图 KIE / 万相串行；与 ecom BFF 600s 对齐 */
export const maxDuration = 600;

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
    const recovered = await reconcileDetailPageSuiteProjectFromAssets(
      auth.userId,
      result.project,
    );
    if (result.failures.length > 0) {
      console.error("[detail-page-suite] images/generate partial failure", {
        projectId: id,
        userId: auth.userId,
        generated: result.generated,
        failures: result.failures,
      });
    }
    return NextResponse.json({
      ...result,
      project: recovered.project,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "生图失败";
    console.error("[detail-page-suite] images/generate error", {
      projectId: id,
      userId: auth.userId,
      message,
    });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
