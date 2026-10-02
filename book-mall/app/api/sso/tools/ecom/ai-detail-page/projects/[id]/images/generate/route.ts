import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";

import {
  generateDetailPageSuiteImages,
  normalizeDetailPageSuiteImageGenSlotKeys,
} from "@/lib/ecom/detail-page-suite/image-gen";
import { ECOM_AI_DETAIL_PAGE_MODULE } from "@/lib/ecom/detail-page-suite/types";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
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
      return ecomJson(
        { error: "请勾选要出图的点位（slotKeys 不能为空）" },
        { status: 400 },
      );
    }
    const result = await generateDetailPageSuiteImages({
      userId: auth.userId,
      projectId: id,
      projectModule: ECOM_AI_DETAIL_PAGE_MODULE,
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
    });
    return ecomJson(result);
  } catch (e) {
    console.error("[ai-detail-page] images/generate error", e);
    return ecomJson(
      { error: e instanceof Error ? e.message : "出图失败" },
      { status: 500 },
    );
  }
}
