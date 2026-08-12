import { NextResponse } from "next/server";
import { verifyCredentialsLogin } from "@/lib/auth/verify-credentials";
import {
  issueClientSession,
  parseClientDeviceType,
} from "@/lib/client-device-service";
import { withApiDbGuard } from "@/lib/http/api-db-error";

export const dynamic = "force-dynamic";

/**
 * 客户端登录（扩展 / 桌面 / 网页客户端）。
 * 校验手机号 + 密码或验证码，签发 access_token + refresh_token + deviceId。
 */
export const POST = withApiDbGuard(async (req) => {
  let body:
    | {
        phone?: string;
        password?: string;
        code?: string;
        loginMode?: string;
        deviceType?: string;
        deviceName?: string;
      }
    | null = null;
  try {
    body = (await req.json()) as typeof body;
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

  const verified = await verifyCredentialsLogin({
    phone: body?.phone,
    password: body?.password,
    code: body?.code,
    loginMode,
  });

  if (!verified) {
    return NextResponse.json(
      {
        error:
          loginMode === "password" ? "手机号或密码错误" : "手机号或验证码错误",
      },
      { status: 401 },
    );
  }

  const issued = await issueClientSession({
    userId: verified.id,
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
