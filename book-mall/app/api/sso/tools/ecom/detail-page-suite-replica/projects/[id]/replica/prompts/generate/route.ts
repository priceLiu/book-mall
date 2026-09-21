import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { ReplicaDecomposeAlreadyRunningError } from "@/lib/ecom/detail-page-suite-replica/replica-decompose-service";
import { generateDetailPageSuiteReplicaPrompts } from "@/lib/ecom/detail-page-suite-replica/replica-prompts-generate-service";
import { getDetailPageSuiteReplicaProject } from "@/lib/ecom/detail-page-suite/project-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    /* empty */
  }

  const moduleIds = Array.isArray(body.moduleIds)
    ? body.moduleIds.filter((x): x is string => typeof x === "string")
    : [];

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const project = await generateDetailPageSuiteReplicaPrompts({
      userId: auth.userId,
      projectId: id,
      moduleIds,
      chatModelKey: typeof body.chatModelKey === "string" ? body.chatModelKey : undefined,
    });
    return NextResponse.json({ project });
  } catch (e) {
    if (e instanceof ReplicaDecomposeAlreadyRunningError) {
      const project = await getDetailPageSuiteReplicaProject(auth.userId, id);
      return NextResponse.json({ error: e.message, project }, { status: 409 });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "生成 Prompt 失败" },
      { status: 500 },
    );
  }
}
