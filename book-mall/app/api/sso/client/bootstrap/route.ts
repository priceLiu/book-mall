import { NextResponse, type NextRequest } from "next/server";
import {
  issueClientSession,
  parseClientDeviceType,
} from "@/lib/client-device-service";
import { resolvePlatformUser } from "@/lib/platform-auth";
import { withApiDbGuard } from "@/lib/http/api-db-error";

export const dynamic = "force-dynamic";

/**
 * 已登录用户（tools JWT / NextAuth）-bootstrap 客户端长效凭证。
 * 供 publisher-web 登录回调页为扩展 / 桌面签发 refresh_token。
 */
export const POST = withApiDbGuard(async (req: NextRequest) => {
  const user = await resolvePlatformUser(req);
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  let body: { deviceType?: string; deviceName?: string } | null = null;
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "无效请求体" }, { status: 400 });
  }

  const deviceType = parseClientDeviceType(body?.deviceType);
  if (!deviceType) {
    return NextResponse.json({ error: "缺少或无效的 deviceType" }, { status: 400 });
  }

  const issued = await issueClientSession({
    userId: user.id,
    deviceType,
    deviceName: body?.deviceName,
    userAgent: req.headers.get("user-agent"),
  });

  if ("ok" in issued && issued.ok === false) {
    return NextResponse.json({ error: issued.error }, { status: issued.status });
  }

  const session = issued as Awaited<ReturnType<typeof issueClientSession>> & {
    accessToken: string;
  };

  return NextResponse.json({
    ok: true,
    access_token: session.accessToken,
    refresh_token: session.refreshToken,
    expires_in: session.expiresIn,
    device_id: session.deviceId,
    user_id: session.userId,
    token_type: "Bearer",
  });
});
