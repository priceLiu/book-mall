import { NextResponse } from "next/server";
import { forwardToBook } from "@/lib/portal-auth-bff";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: Record<string, unknown> | null = null;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "无效请求体" }, { status: 400 });
  }

  const result = await forwardToBook("/api/auth/register", {
    method: "POST",
    clientRequest: req,
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
