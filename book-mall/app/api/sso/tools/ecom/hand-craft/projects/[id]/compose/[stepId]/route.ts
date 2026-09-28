import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { saveHandCraftComposePng } from "@/lib/ecom/ecom-hand-craft-compose";
import { getEcomHandCraftProject } from "@/lib/ecom/ecom-hand-craft-service";
import { isHandCraftStepId } from "@/lib/ecom/ecom-hand-craft-steps";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string; stepId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  const { id, stepId } = await ctx.params;
  if (!isHandCraftStepId(stepId)) {
    return ecomJson({ error: "未知步骤" }, { status: 400 });
  }

  let body: { pngBase64?: unknown; pageIndex?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return ecomJson({ error: "无效 JSON" }, { status: 400 });
  }

  const raw = typeof body.pngBase64 === "string" ? body.pngBase64.trim() : "";
  const b64 = raw.replace(/^data:image\/png;base64,/, "");
  if (!b64) return ecomJson({ error: "缺少 pngBase64" }, { status: 400 });

  const buf = Buffer.from(b64, "base64");
  if (buf.length > 30 * 1024 * 1024) {
    return ecomJson({ error: "PNG 过大（最大 30MB）" }, { status: 413 });
  }

  const pageIndex = Number(body.pageIndex ?? 1);
  if (!Number.isInteger(pageIndex) || pageIndex <= 0) {
    return ecomJson({ error: "无效 pageIndex" }, { status: 400 });
  }

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const { imageUrl } = await saveHandCraftComposePng({
      userId: auth.userId,
      projectId: id,
      stepId,
      pageIndex,
      buf,
    });
    const project = await getEcomHandCraftProject(auth.userId, id);
    return ecomJson({ imageUrl, project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "上传失败";
    return ecomJson({ error: message }, { status: 500 });
  }
}
