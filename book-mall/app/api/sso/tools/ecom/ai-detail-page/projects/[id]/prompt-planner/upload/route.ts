import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import {
  patchAplusPromptPlanner,
  uploadAplusPromptPlannerFile,
} from "@/lib/ecom/detail-page-suite/project-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;

  let body: { customSystemBody?: string; mode?: "default" | "custom" };
  try {
    body = await req.json();
  } catch {
    return ecomJson({ error: "无效 JSON" }, { status: 400 });
  }

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const project = await patchAplusPromptPlanner({
      userId: auth.userId,
      projectId: id,
      customSystemBody: body.customSystemBody,
      mode: body.mode,
    });
    if (!project) {
      return ecomJson({ error: "项目不存在" }, { status: 404 });
    }
    return ecomJson({ project });
  } catch (e) {
    return ecomJson(
      { error: e instanceof Error ? e.message : "保存失败" },
      { status: 400 },
    );
  }
}

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return ecomJson({ error: "缺少 file 字段" }, { status: 400 });
  }
  const buf = Buffer.from(await file.arrayBuffer());

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const project = await uploadAplusPromptPlannerFile({
      userId: auth.userId,
      projectId: id,
      buf,
      fileName: file.name || "planner.txt",
    });
    if (!project) {
      return ecomJson({ error: "项目不存在" }, { status: 404 });
    }
    return ecomJson({ project });
  } catch (e) {
    return ecomJson(
      { error: e instanceof Error ? e.message : "上传失败" },
      { status: 400 },
    );
  }
}
