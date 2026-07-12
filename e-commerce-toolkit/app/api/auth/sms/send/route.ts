import { NextResponse } from "next/server";
import { forwardToBook } from "@/lib/portal-auth-bff";

export const dynamic = "force-dynamic";

/** 门户短信 BFF：转发 Book /api/auth/sms/send（dev 回传 mockCode）。 */
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

  const result = await forwardToBook("/api/auth/sms/send", {
    method: "POST",
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
