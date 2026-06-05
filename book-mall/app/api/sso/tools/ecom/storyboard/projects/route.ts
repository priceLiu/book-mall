import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import {
  createEcomStoryboardProject,
  listEcomStoryboardProjects,
} from "@/lib/ecom/ecom-storyboard-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const items = await listEcomStoryboardProjects(auth.userId);
    return NextResponse.json({ items });
  } catch (e) {
    const message = e instanceof Error ? e.message : "加载失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    /* empty */
  }
  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const title = typeof body.title === "string" ? body.title : undefined;
    const brief =
      body.brief && typeof body.brief === "object"
        ? (body.brief as Record<string, unknown>)
        : undefined;
    const project = await createEcomStoryboardProject(auth.userId, { title, brief });
    return NextResponse.json({ project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "创建失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
