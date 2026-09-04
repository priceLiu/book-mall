import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { splitEcomOutfitVideoScenes } from "@/lib/ecom/ecom-outfit-video-service";
import { isOutfitVideoMockAllowed } from "@/lib/ecom/ecom-outfit-video-mock";
import { MediaRenderUnavailableError } from "@/lib/media/ffmpeg-preflight";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** FFmpeg 切镜 + 逐镜 Qwen 视觉分析，与 toolkit BFF maxDuration 对齐 */
export const maxDuration = 600;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;

  let mock = isOutfitVideoMockAllowed();
  let splitModelKey: string | undefined;
  let forceResplit = false;
  try {
    const body = (await req.json().catch(() => ({}))) as {
      mock?: unknown;
      splitModelKey?: unknown;
      forceResplit?: unknown;
    };
    if (typeof body.mock === "boolean") mock = body.mock;
    if (typeof body.splitModelKey === "string" && body.splitModelKey.trim()) {
      splitModelKey = body.splitModelKey.trim();
    }
    forceResplit = body.forceResplit === true;
  } catch {
    /* empty body */
  }

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const { project, envelope } = await splitEcomOutfitVideoScenes(auth.userId, id, {
      mock,
      splitModelKey,
      forceResplit,
    });
    return NextResponse.json({ project, envelope, mock });
  } catch (e) {
    if (e instanceof MediaRenderUnavailableError) {
      return NextResponse.json({ error: e.message }, { status: 503 });
    }
    const message = e instanceof Error ? e.message : "拆镜失败";
    const status = message.includes("不存在")
      ? 404
      : message.includes("请先") || message.includes("已完成拆镜")
        ? 400
        : message.includes("拆镜正在进行中")
          ? 409
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
