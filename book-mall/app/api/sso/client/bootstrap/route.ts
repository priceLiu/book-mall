import { NextResponse, type NextRequest } from "next/server";
import {
  issueClientSession,
  parseClientDeviceType,
} from "@/lib/client-device-service";
import { resolvePlatformUser } from "@/lib/platform-auth";
import { withApiDbGuard } from "@/lib/http/api-db-error";

export const dynamic = "force-dynamic";

type BootstrapBody = { deviceType?: string; deviceName?: string };

/**
 * 已登录用户（tools JWT / NextAuth）-bootstrap 客户端长效凭证。
 * 供 publisher-web 登录回调页为扩展 / 桌面签发 refresh_token。
 */
export const POST = withApiDbGuard(async (req: NextRequest) => {
  const user = await resolvePlatformUser(req);
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  let body: BootstrapBody | null = null;
  try {
    body = (await req.json()) as BootstrapBody | null;
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

  // 成功分支没有 ok 字段，判存在即可收窄；再加 === false 会让收窄失效
  if ("ok" in issued) {
    return NextResponse.json({ error: issued.error }, { status: issued.status });
  }

  return NextResponse.json({
    ok: true,
    access_token: issued.accessToken,
    refresh_token: issued.refreshToken,
    expires_in: issued.expiresIn,
    device_id: issued.deviceId,
    user_id: issued.userId,
    token_type: "Bearer",
  });
});
