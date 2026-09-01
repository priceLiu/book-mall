import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import {
  attachFilmPullModelFromLibrary,
  attachFilmPullRefsFromAssets,
} from "@/lib/ecom/ecom-film-pull-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function mapAttachError(e: unknown, fallback: string): { message: string; status: number } {
  const message = e instanceof Error ? e.message : fallback;
  const status =
    message.includes("请先") ||
    message.includes("缺少") ||
    message.includes("无效") ||
    message.includes("最多") ||
    message.includes("至少")
      ? 400
      : 502;
  return { message, status };
}

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);

    if (Array.isArray(body.assetIds)) {
      const roleRaw = body.role;
      const role = roleRaw === "model" || roleRaw === "product" ? roleRaw : null;
      if (!role) {
        return NextResponse.json({ error: "role 须为 model 或 product" }, { status: 400 });
      }
      const assetIds = body.assetIds.filter((x): x is string => typeof x === "string");
      const project = await attachFilmPullRefsFromAssets(auth.userId, id, role, assetIds);
      return NextResponse.json({ project });
    }

    if (body.modelEntry && typeof body.modelEntry === "object") {
      const entry = body.modelEntry as { id?: string; name?: string; ossUrl?: string };
      if (!entry.id || !entry.ossUrl) {
        return NextResponse.json({ error: "modelEntry 无效" }, { status: 400 });
      }
      const project = await attachFilmPullModelFromLibrary(auth.userId, id, {
        id: entry.id,
        name: entry.name ?? "模特",
        ossUrl: entry.ossUrl,
      });
      return NextResponse.json({ project });
    }

    return NextResponse.json({ error: "请求体无效" }, { status: 400 });
  } catch (e) {
    const { message, status } = mapAttachError(e, "导入失败");
    return NextResponse.json({ error: message }, { status });
  }
}
