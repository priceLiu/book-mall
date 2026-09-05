import { NextResponse } from "next/server";

import { generateHandCraftStepImages } from "@/lib/ecom/ecom-hand-craft-image";
import { getEcomHandCraftProject } from "@/lib/ecom/ecom-hand-craft-service";
import { isHandCraftStepId } from "@/lib/ecom/ecom-hand-craft-steps";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string; stepId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id, stepId } = await ctx.params;
  if (!isHandCraftStepId(stepId)) {
    return NextResponse.json({ error: "未知步骤" }, { status: 400 });
  }

  let body: {
    indexes?: unknown;
    modelKey?: unknown;
    concurrency?: unknown;
    imageSize?: unknown;
  } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    /* 允许空 body：表示生成本步全部槽位 */
  }

  const indexes = Array.isArray(body.indexes)
    ? body.indexes
        .map((v) => Number(v))
        .filter((v) => Number.isInteger(v) && v > 0)
    : undefined;

  try {
    const result = await generateHandCraftStepImages({
      userId: auth.userId,
      projectId: id,
      stepId,
      indexes,
      modelKey: typeof body.modelKey === "string" ? body.modelKey : undefined,
      concurrency:
        typeof body.concurrency === "number" ? body.concurrency : undefined,
      imageSize:
        typeof body.imageSize === "string" ? body.imageSize : undefined,
    });
    const project = await getEcomHandCraftProject(auth.userId, id);
    return NextResponse.json({ ...result, project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "生成失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
