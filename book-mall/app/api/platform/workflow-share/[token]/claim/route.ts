import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { resolvePlatformUser } from "@/lib/platform-auth";
import {
  claimWorkflowShare,
  workflowShareRedirectPath,
} from "@/lib/share/workflow-share-service";
import { resolveEcomWorkflowShareRedirectPath } from "@/lib/ecom/ecom-workflow-share-duplicate";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } },
) {
  const user = await resolvePlatformUser(request);
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const token = params.token?.trim();
  if (!token) {
    return NextResponse.json({ error: "无效 token" }, { status: 400 });
  }

  try {
    const result = await claimWorkflowShare({
      token,
      claimerUserId: user.id,
    });
    const redirectPath =
      result.app === "ECOM"
        ? await resolveEcomWorkflowShareRedirectPath(
            result.resourceType,
            result.clonedResourceId,
          )
        : workflowShareRedirectPath(
            result.app,
            result.clonedResourceId,
            result.resourceType,
          );
    return NextResponse.json({
      ok: true,
      ...result,
      redirectPath,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "领取失败";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
