import { NextResponse } from "next/server";

import {
  generateDetailPageSuiteImages,
  normalizeDetailPageSuiteImageGenSlotKeys,
} from "@/lib/ecom/detail-page-suite/image-gen";
import { ECOM_DETAIL_PAGE_SUITE_HIT_MODULE } from "@/lib/ecom/detail-page-suite/types";
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
    const slotKeys = normalizeDetailPageSuiteImageGenSlotKeys(
      Array.isArray(body.slotKeys)
        ? body.slotKeys.map((x) => String(x)).filter(Boolean)
        : undefined,
    );
    if (!slotKeys?.length) {
      return NextResponse.json(
        { error: "请勾选要出图的点位（slotKeys 不能为空）" },
        { status: 400 },
      );
    }
    console.info("[detail-page-suite-hit] images/generate request", {
      projectId: id,
      moduleId: typeof body.moduleId === "string" ? body.moduleId : null,
      slotKeyCount: slotKeys.length,
      slotKeys,
    });
    const result = await generateDetailPageSuiteImages({
      userId: auth.userId,
      projectId: id,
      projectModule: ECOM_DETAIL_PAGE_SUITE_HIT_MODULE,
      moduleId: typeof body.moduleId === "string" ? body.moduleId : undefined,
      slotKey: typeof body.slotKey === "string" ? body.slotKey : undefined,
      slotKeys,
      onlySelected: body.onlySelected === true,
      modelKey: typeof body.modelKey === "string" ? body.modelKey : undefined,
      imageSize: typeof body.imageSize === "string" ? body.imageSize : undefined,
      imageRatio:
        body.imageRatio === "1:1" ||
        body.imageRatio === "3:4" ||
        body.imageRatio === "4:5" ||
        body.imageRatio === "16:9"
          ? body.imageRatio
          : undefined,
      includeSlotCopyOnImage: body.includeSlotCopyOnImage === true,
      activeExportTargetIds: Array.isArray(body.activeExportTargetIds)
        ? body.activeExportTargetIds.map((x) => String(x).trim()).filter(Boolean)
        : undefined,
    });
    if (result.failures.length > 0) {
      console.error("[detail-page-suite-hit] images/generate partial failure", {
        projectId: id,
        failures: result.failures,
      });
    }
    return NextResponse.json(result);
  } catch (e) {
    console.error("[detail-page-suite-hit] images/generate error", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "出图失败" },
      { status: 500 },
    );
  }
}
