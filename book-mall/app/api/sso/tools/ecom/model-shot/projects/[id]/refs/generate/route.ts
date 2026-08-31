import { NextResponse } from "next/server";

import { generateModelShotReferenceImage } from "@/lib/ecom/ecom-model-shot-ref-gen";
import type { ModelShotReferenceRole } from "@/lib/ecom/ecom-model-shot-types";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id: projectId } = await ctx.params;

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    /* */
  }

  const roleRaw = body.role;
  const role =
    roleRaw === "model" || roleRaw === "scene" || roleRaw === "prop"
      ? (roleRaw as ModelShotReferenceRole)
      : null;
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const modelKey = typeof body.modelKey === "string" ? body.modelKey.trim() : undefined;

  if (!role) {
    return NextResponse.json({ error: "role 须为 model / scene / prop" }, { status: 400 });
  }
  if (!prompt) {
    return NextResponse.json({ error: "请填写 Prompt" }, { status: 400 });
  }

  try {
    const result = await generateModelShotReferenceImage({
      userId: auth.userId,
      projectId,
      role,
      prompt,
      modelKey,
    });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "生成失败";
    const status =
      message === "项目不存在"
        ? 404
        : message.includes("请填写") || message.includes("服装")
          ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
