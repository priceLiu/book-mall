import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { WorkflowShareApp } from "@prisma/client";
import { z } from "zod";

import { resolvePlatformUser } from "@/lib/platform-auth";
import { createWorkflowShareLink } from "@/lib/share/workflow-share-service";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  app: z.enum(["CANVAS", "ECOM", "QUICK_REPLICA"]),
  resourceType: z.string().min(1).max(64),
  resourceId: z.string().min(1),
  title: z.string().max(120).optional(),
  maxClaims: z.number().int().positive().optional(),
});

export async function POST(request: NextRequest) {
  const user = await resolvePlatformUser(request);
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "无效 JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const link = await createWorkflowShareLink({
      sharerUserId: user.id,
      app: parsed.data.app as WorkflowShareApp,
      resourceType: parsed.data.resourceType,
      resourceId: parsed.data.resourceId,
      title: parsed.data.title,
      maxClaims: parsed.data.maxClaims,
    });
    return NextResponse.json({ ok: true, ...link });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "创建失败";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
