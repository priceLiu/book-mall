import { NextResponse } from "next/server";
import { forwardToBook } from "@/lib/portal-auth-bff";

export const dynamic = "force-dynamic";

/**
 * 门户注册 BFF：转发 Book /api/auth/register（复用主站注册逻辑，不重写）。
 * 成功返回 autoLoginToken；前端据此跳 Book /portal-signin 建立会话。
 */
export async function POST(req: Request) {
  let body: Record<string, unknown> | null = null;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "无效请求体" }, { status: 400 });
  }

  const result = await forwardToBook("/api/auth/register", {
    method: "POST",
    body: {
      phone: body?.phone,
      code: body?.code,
      password: body?.password,
      name: body?.name,
    },
  });

  if (!result.ok) {
    const err = result.data.error;
    return NextResponse.json(
      { error: typeof err === "string" ? err : "注册失败，请稍后重试" },
      { status: result.status },
    );
  }

  return NextResponse.json({
    ok: true,
    autoLoginToken: result.data.autoLoginToken,
    phone: result.data.phone,
    passwordless: result.data.passwordless,
  });
}
