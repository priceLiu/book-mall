import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import {
  ensureFilmPullReplicaSeedProject,
  upsertFilmPullReplicaReference,
} from "@/lib/ecom/ecom-film-pull-replica";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "无效表单" }, { status: 400 });
  }

  const roleRaw = String(form.get("role") ?? "").trim();
  if (roleRaw !== "model" && roleRaw !== "product") {
    return NextResponse.json({ error: "role 须为 model 或 product" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "缺少 file" }, { status: 400 });
  }
  if (file.size > 30 * 1024 * 1024) {
    return NextResponse.json({ error: "文件过大（最大 30MB）" }, { status: 413 });
  }

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    await ensureFilmPullReplicaSeedProject(auth.userId, id);
    const buf = Buffer.from(await file.arrayBuffer());
    const { project, seedVideo, reference } = await upsertFilmPullReplicaReference(
      auth.userId,
      id,
      roleRaw,
      buf,
    );
    return NextResponse.json({ project, seedVideo, reference });
  } catch (e) {
    const message = e instanceof Error ? e.message : "上传失败";
    const status = message.includes("请先") || message.includes("缺少") ? 400 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
