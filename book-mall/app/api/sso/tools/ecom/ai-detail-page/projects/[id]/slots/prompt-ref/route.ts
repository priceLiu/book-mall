import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { appendAplusSlotPromptRef } from "@/lib/ecom/detail-page-suite/project-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;

  const form = await req.formData();
  const file = form.get("file");
  const moduleId = String(form.get("moduleId") ?? "");
  const slotId = String(form.get("slotId") ?? "");
  if (!(file instanceof File) || !moduleId || !slotId) {
    return ecomJson({ error: "需要 file、moduleId、slotId" }, { status: 400 });
  }
  const buf = Buffer.from(await file.arrayBuffer());

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const project = await appendAplusSlotPromptRef({
      userId: auth.userId,
      projectId: id,
      moduleId,
      slotId,
      buf,
      contentType: file.type || "application/octet-stream",
    });
    if (!project) {
      return ecomJson({ error: "项目不存在或槽位无效" }, { status: 404 });
    }
    return ecomJson({ project });
  } catch (e) {
    return ecomJson(
      { error: e instanceof Error ? e.message : "上传失败" },
      { status: 400 },
    );
  }
}
