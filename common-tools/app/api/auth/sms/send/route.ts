import { NextResponse } from "next/server";
import { forwardToBook } from "@/lib/portal-auth-bff";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { phone?: string; purpose?: string } | null = null;
  try {
    body = (await req.json()) as { phone?: string; purpose?: string };
  } catch {
    return NextResponse.json({ error: "无效请求体" }, { status: 400 });
  }

  const purpose =
    body?.purpose === "REGISTER" || body?.purpose === "LOGIN"
      ? body.purpose
      : "LOGIN";

  const result = await forwardToBook("/api/sso/portal/sms/send", {
    method: "POST",
    withServerSecret: true,
    clientRequest: req,
    body: { phone: body?.phone, purpose },
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: (result.data.error as string) ?? "发送失败" },
      { status: result.status },
    );
  }

  return NextResponse.json({
    ok: true,
    ...(result.data.mockCode ? { mockCode: result.data.mockCode } : {}),
  });
}
