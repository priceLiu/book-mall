import { NextResponse } from "next/server";
import { toolsExchangeAuthorized } from "@/lib/sso-tools-env";
import { verifyCredentialsLogin } from "@/lib/auth/verify-credentials";
import { issueAutoLoginToken } from "@/lib/auth/auto-login-token";

export const dynamic = "force-dynamic";

/**
 * 门户无头登录：子应用 BFF（服务端）用 TOOLS_SSO_SERVER_SECRET 调用。
 * 校验手机号 + (密码 | 短信验证码)，成功后签发一次性自动登录票据（autoLoginToken）。
 *
 * 门户前端拿到 token 后整页跳 Book `/portal-signin` 建立 Book 会话，再走既有
 * `re-enter → exchange → callback` 落子应用 tools_token。
 *
 * 注意：本端点 **不做工具准入判定**（登录 != 开通）。准入在生成/网关路径复查。
 */
export async function POST(req: Request) {
  if (!toolsExchangeAuthorized(req)) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  let body:
    | { phone?: string; password?: string; code?: string; loginMode?: string }
    | null = null;
  try {
    body = (await req.json()) as {
      phone?: string;
      password?: string;
      code?: string;
      loginMode?: string;
    };
  } catch {
    return NextResponse.json({ error: "无效请求体" }, { status: 400 });
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

  let autoLoginToken: string;
  try {
    autoLoginToken = issueAutoLoginToken(verified.id);
  } catch (e) {
    console.error("[portal/verify] issueAutoLoginToken", e);
    return NextResponse.json(
      { error: "服务端未正确配置（NEXTAUTH_SECRET）" },
      { status: 503 },
    );
  }

  return NextResponse.json({
    ok: true,
    autoLoginToken,
    userId: verified.id,
  });
}
