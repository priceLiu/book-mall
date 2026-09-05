import { NextResponse } from "next/server";
import { forwardToBook } from "@/lib/portal-auth-bff";

export const dynamic = "force-dynamic";

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
    clientRequest: req,
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
