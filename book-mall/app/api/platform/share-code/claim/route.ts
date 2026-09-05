import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { resolvePlatformUser } from "@/lib/platform-auth";
import {
  isShareCodeRateLimited,
  SHARE_CODE_CLAIM_RATE_LIMIT,
  shareCodeRateLimitKey,
} from "@/lib/share/share-code-rate-limit";
import {
  normalizeShareCode,
  SHARE_CODE_INVALID_MESSAGE,
} from "@/lib/share/share-code-service";
import {
  claimWorkflowShare,
  workflowShareAbsoluteRedirectUrl,
} from "@/lib/share/workflow-share-service";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  code: z.string().min(1).max(32),
});

function clientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(request: NextRequest) {
  const user = await resolvePlatformUser(request);
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const ip = clientIp(request);
  if (
    isShareCodeRateLimited(
      shareCodeRateLimitKey(ip, "claim"),
      SHARE_CODE_CLAIM_RATE_LIMIT,
    )
  ) {
    return NextResponse.json({ error: "请求过于频繁，请稍后再试" }, { status: 429 });
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

  const shortCode = normalizeShareCode(parsed.data.code);
  if (!shortCode) {
    return NextResponse.json({ error: SHARE_CODE_INVALID_MESSAGE }, { status: 400 });
  }

  try {
    const result = await claimWorkflowShare({
      shortCode,
      claimerUserId: user.id,
    });
    return NextResponse.json({
      ok: true,
      ...result,
      redirectUrl: workflowShareAbsoluteRedirectUrl(
        result.app,
        result.clonedResourceId,
        result.resourceType,
      ),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : SHARE_CODE_INVALID_MESSAGE;
    return NextResponse.json(
      { error: msg.includes("无效") || msg.includes("过期") || msg.includes("上限") ? msg : SHARE_CODE_INVALID_MESSAGE },
      { status: 400 },
    );
  }
}
