import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import {
  addIpMasterBenchmarkUpload,
  getEcomIpMasterProject,
} from "@/lib/ecom/ecom-ip-master-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return ecomJson({ error: "无效表单" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return ecomJson({ error: "缺少 file" }, { status: 400 });
  }
  if (file.size > 30 * 1024 * 1024) {
    return ecomJson({ error: "文件过大（最大 30MB）" }, { status: 413 });
  }

  const label = String(form.get("label") ?? "基准图").slice(0, 40);

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const buf = Buffer.from(await file.arrayBuffer());
    const ref = await addIpMasterBenchmarkUpload(auth.userId, id, { label, buf });
    const project = await getEcomIpMasterProject(auth.userId, id);
    return ecomJson({ reference: ref, project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "上传失败";
    return ecomJson({ error: message }, { status: 500 });
  }
}
