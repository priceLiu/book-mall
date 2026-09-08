import { NextResponse } from "next/server";

import {
  createEcomModelTryonProject,
  listEcomModelTryonProjects,
} from "@/lib/ecom/ecom-model-tryon-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const items = await listEcomModelTryonProjects(auth.userId);
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    /* */
  }
  const title = typeof body.title === "string" ? body.title : undefined;

  try {
    const project = await createEcomModelTryonProject(auth.userId, { title });
    return NextResponse.json({ project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "创建项目失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
