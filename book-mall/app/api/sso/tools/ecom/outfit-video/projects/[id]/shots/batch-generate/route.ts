import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { batchGenerateEcomOutfitVideoShots } from "@/lib/ecom/ecom-outfit-video-service";
import { isOutfitVideoMockAllowed } from "@/lib/ecom/ecom-outfit-video-mock";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;

  let body: {
    indices?: unknown;
    mock?: boolean;
    videoModelKey?: string;
    scenePrompts?: Record<string, string>;
  } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "无效 JSON" }, { status: 400 });
  }

  const indices = Array.isArray(body.indices)
    ? body.indices
        .filter((n): n is number => typeof n === "number" && Number.isFinite(n))
        .map((n) => Math.trunc(n))
        .filter((n) => n >= 1)
    : [];
  if (indices.length === 0) {
    return NextResponse.json({ error: "请选择至少一个镜号" }, { status: 400 });
  }

  const mock = typeof body.mock === "boolean" ? body.mock : isOutfitVideoMockAllowed();
  const videoModelKey =
    typeof body.videoModelKey === "string" ? body.videoModelKey.trim() : undefined;

  const scenePrompts =
    body.scenePrompts && typeof body.scenePrompts === "object" && !Array.isArray(body.scenePrompts)
      ? Object.fromEntries(
          Object.entries(body.scenePrompts as Record<string, unknown>).filter(
            (entry): entry is [string, string] => typeof entry[1] === "string",
          ),
        )
      : undefined;

  try {
    if (!mock) await assertEcomToolkitGatewayAccess(auth.userId);
    const project = await batchGenerateEcomOutfitVideoShots(auth.userId, id, indices, {
      mock,
      videoModelKey,
      scenePrompts,
    });
    return NextResponse.json({ project, mock });
  } catch (e) {
    const message = e instanceof Error ? e.message : "批量生成失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
