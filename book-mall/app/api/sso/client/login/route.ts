import { NextResponse } from "next/server";
import { verifyLoginWithThrottle } from "@/lib/auth/login-with-throttle";
import {
  issueClientSession,
  parseClientDeviceType,
} from "@/lib/client-device-service";
import { withApiDbGuard } from "@/lib/http/api-db-error";
import { clientIpFromRequest } from "@/lib/site-traffic/client-ip";

export const dynamic = "force-dynamic";

type LoginBody = {
  phone?: string;
  password?: string;
  code?: string;
  loginMode?: string;
  deviceType?: string;
  deviceName?: string;
};

/**
 * 客户端登录（扩展 / 桌面 / 网页客户端）。
 * 校验手机号 + 密码或验证码，签发 access_token + refresh_token + deviceId。
 */
export const POST = withApiDbGuard(async (req) => {
  let body: LoginBody | null = null;
  try {
    body = (await req.json()) as LoginBody | null;
  } catch {
    return NextResponse.json({ error: "无效请求体" }, { status: 400 });
  }

  const deviceType = parseClientDeviceType(body?.deviceType);
  if (!deviceType) {
    return NextResponse.json({ error: "缺少或无效的 deviceType" }, { status: 400 });
  }

  const loginMode = body?.loginMode?.trim() || "password";
  if (loginMode !== "password" && loginMode !== "otp") {
    return NextResponse.json({ error: "不支持的登录方式" }, { status: 400 });
  }

  const verified = await verifyLoginWithThrottle({
    credentials: {
      phone: body?.phone,
      password: body?.password,
      code: body?.code,
      loginMode,
    },
    ip: clientIpFromRequest(req),
  });

  if (!verified.ok) {
    return NextResponse.json({ error: verified.error }, { status: verified.status });
  }

  const issued = await issueClientSession({
    userId: verified.user.id,
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
