import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import {
  createDetailPageSuiteHitProject,
  listDetailPageSuiteHitProjects,
  listDetailPageSuiteHitSummaries,
} from "@/lib/ecom/detail-page-suite/project-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const url = new URL(req.url);
    if (url.searchParams.get("summary") === "1") {
      const items = await listDetailPageSuiteHitSummaries(auth.userId);
      return NextResponse.json({ items });
    }
    const items = await listDetailPageSuiteHitProjects(auth.userId);
    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "加载失败" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    /* empty */
  }
  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const title = typeof body.title === "string" ? body.title : undefined;
    const project = await createDetailPageSuiteHitProject(auth.userId, { title });
    return NextResponse.json({ project });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "创建失败" },
      { status: 500 },
    );
  }
}
