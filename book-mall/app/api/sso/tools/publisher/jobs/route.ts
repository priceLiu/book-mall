import { NextResponse, type NextRequest } from "next/server";
import {
  newPublisherJobId,
  PUBLISHER_PLATFORMS,
  signPublisherJobTicket,
  userHasPublisherAccess,
  type PublisherPlatform,
} from "@/lib/publisher/publisher-job-ticket";
import { resolvePlatformUser } from "@/lib/platform-auth";
import { withApiDbGuard } from "@/lib/http/api-db-error";

export const dynamic = "force-dynamic";

/**
 * POST /api/sso/tools/publisher/jobs
 * 校验用户 + social-publisher navKey 准入，签发短时 jobTicket（不扣积分）。
 */
export const POST = withApiDbGuard(async (req: NextRequest) => {
  const user = await resolvePlatformUser(req);
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const entitled = await userHasPublisherAccess(user.id);
  if (!entitled) {
    return NextResponse.json(
      {
        error: "未开通「一键发布」工具技术服务费，请先在个人中心开通 social-publisher",
        code: "PUBLISHER_NOT_ENTITLED",
      },
      { status: 403 },
    );
  }

  let body: { platforms?: string[] } | null = null;
  try {
    body = (await req.json()) as { platforms?: string[] };
  } catch {
    return NextResponse.json({ error: "无效请求体" }, { status: 400 });
  }

  const requested = body?.platforms ?? [...PUBLISHER_PLATFORMS];
  const platforms: PublisherPlatform[] = [];
  for (const p of requested) {
    if ((PUBLISHER_PLATFORMS as readonly string[]).includes(p)) {
      platforms.push(p as PublisherPlatform);
    }
  }
  if (platforms.length === 0) {
    return NextResponse.json({ error: "缺少有效 platforms" }, { status: 400 });
  }

  const jobId = newPublisherJobId();
  const jobTicket = signPublisherJobTicket({
    jobId,
    userId: user.id,
    platforms,
  });

  if (!jobTicket) {
    return NextResponse.json({ error: "服务端未配置签名密钥" }, { status: 503 });
  }

  return NextResponse.json({
    ok: true,
    jobId,
    jobTicket,
    userId: user.id,
    platforms,
    expiresIn: 15 * 60,
  });
});
