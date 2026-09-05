import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { isSeedVideoSkillKey } from "@/lib/ecom/ecom-seed-video-skills";
import {
  createEcomSeedVideoProject,
  listEcomSeedVideoProjects,
  listEcomSeedVideoProjectSummaries,
} from "@/lib/ecom/ecom-seed-video-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const url = new URL(req.url);
    if (url.searchParams.get("summary") === "1") {
      const items = await listEcomSeedVideoProjectSummaries(auth.userId);
      return NextResponse.json({ items });
    }
    const items = await listEcomSeedVideoProjects(auth.userId);
    return NextResponse.json({ items });
  } catch (e) {
    const message = e instanceof Error ? e.message : "加载失败";
    return NextResponse.json({ error: message }, { status: 500 });
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
    const skillKeyRaw = body.skillKey;
    const skillKey = isSeedVideoSkillKey(skillKeyRaw) ? skillKeyRaw : undefined;
    const project = await createEcomSeedVideoProject(auth.userId, { title, skillKey });
    return NextResponse.json({ project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "创建失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
