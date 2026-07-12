import { NextResponse } from "next/server";
import { forwardToBook } from "@/lib/portal-auth-bff";

export const dynamic = "force-dynamic";

/**
 * 门户登录 BFF：校验手机号 + 密码/验证码（转发 Book /api/sso/portal/verify），
 * 成功返回一次性 autoLoginToken；前端据此跳 Book /portal-signin 建立会话。
 */
export async function POST(req: Request) {
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

  const result = await forwardToBook("/api/sso/portal/verify", {
    method: "POST",
    withServerSecret: true,
    body: {
      phone: body?.phone,
      password: body?.password,
      code: body?.code,
      loginMode: body?.loginMode ?? "password",
    },
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: (result.data.error as string) ?? "登录失败" },
      { status: result.status },
    );
  }

  return NextResponse.json({
    ok: true,
    autoLoginToken: result.data.autoLoginToken,
  });
}
