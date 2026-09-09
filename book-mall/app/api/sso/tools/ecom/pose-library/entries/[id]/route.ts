import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import {
  normalizePoseGenders,
  normalizePoseSceneTags,
  type EcomPoseGender,
} from "@/lib/ecom/ecom-pose-library-meta";
import {
  deleteUserPoseEntry,
  getPoseLibraryEntry,
  updateUserPoseEntry,
} from "@/lib/ecom/ecom-pose-library-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const body = (await req.json()) as Record<string, unknown>;
    const patch: Parameters<typeof updateUserPoseEntry>[2] = {};
    if (typeof body.category === "string") patch.category = body.category.trim().toUpperCase();
    if (typeof body.title === "string") patch.title = body.title.trim();
    if (typeof body.baseDescription === "string") {
      patch.baseDescription = body.baseDescription.trim();
    }
    if (Array.isArray(body.genders) || Array.isArray(body.sceneTags)) {
      const existing = await getPoseLibraryEntry(id);
      const genders = Array.isArray(body.genders)
        ? normalizePoseGenders(body.genders as EcomPoseGender[])
        : existing?.genders;
      const sceneTags = Array.isArray(body.sceneTags)
        ? normalizePoseSceneTags(body.sceneTags)
        : existing?.sceneTags;
      patch.genders = genders;
      patch.sceneTags = sceneTags;
      patch.tags = {
        ...(existing?.tags ?? {}),
        ...(genders ? { genders } : {}),
        ...(sceneTags ? { sceneTags } : {}),
      };
    }
    const entry = await updateUserPoseEntry(auth.userId, id, patch);
    return NextResponse.json({ entry });
  } catch (e) {
    const message = e instanceof Error ? e.message : "更新失败";
    const status = message.includes("无权") || message.includes("不可") ? 403 : 500;
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(_req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const ok = await deleteUserPoseEntry(auth.userId, id);
    if (!ok) return NextResponse.json({ error: "条目不存在" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "删除失败";
    const status = message.includes("无权") || message.includes("不可") ? 403 : 500;
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
