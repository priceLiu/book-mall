import { NextResponse } from "next/server";

import {
  appendEcomImageLayerGeneration,
  getEcomImageLayerProject,
} from "@/lib/ecom/ecom-image-layer-project-service";
import {
  IMAGE_LAYER_GENERATION_KINDS,
  sanitizeImageLayerGenerationRefs,
} from "@/lib/ecom/ecom-image-layer-project-types";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return auth.res;
  const { id } = await ctx.params;
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const kind = typeof body.kind === "string" ? body.kind.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const ossUrl = typeof body.ossUrl === "string" ? body.ossUrl.trim() : "";
  if (!IMAGE_LAYER_GENERATION_KINDS.includes(kind as (typeof IMAGE_LAYER_GENERATION_KINDS)[number])) {
    return NextResponse.json({ error: "无效的历史类型" }, { status: 400 });
  }
  if (!title || !ossUrl) {
    return NextResponse.json({ error: "缺少标题或结果图" }, { status: 400 });
  }

  try {
    const existing = await getEcomImageLayerProject(auth.userId, id);
    if (!existing) return NextResponse.json({ error: "项目不存在" }, { status: 404 });
    const compareFromUrl =
      typeof body.compareFromUrl === "string" ? body.compareFromUrl.trim() : "";
    const refImages = sanitizeImageLayerGenerationRefs(body.refImages);
    const project = await appendEcomImageLayerGeneration(auth.userId, id, {
      kind: kind as (typeof IMAGE_LAYER_GENERATION_KINDS)[number],
      title,
      ossUrl,
      prompt: typeof body.prompt === "string" ? body.prompt : null,
      logId: typeof body.logId === "string" ? body.logId : null,
      modelKey: typeof body.modelKey === "string" ? body.modelKey : null,
      ...(compareFromUrl ? { compareFromUrl } : {}),
      ...(refImages.length ? { refImages } : {}),
    });
    return NextResponse.json({ project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "写入历史失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
