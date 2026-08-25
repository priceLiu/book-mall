import { NextResponse, type NextRequest } from "next/server";
import { getBookMallOrigin, gatewaySsoServerSecret } from "@/lib/book-mall-base-url";
import { bookMallFetchErrorMessage, fetchBookMall } from "@/lib/fetch-book-mall";

export const dynamic = "force-dynamic";

/** 透传到 book-mall 门户短信发送（服务端密钥，无需图形验证码）。 */
export async function POST(request: NextRequest) {
  const base = getBookMallOrigin();
  if (!base) {
    return NextResponse.json({ error: "BOOK_MALL_ORIGIN 未配置" }, { status: 503 });
  }
  const secret = gatewaySsoServerSecret();
  if (!secret) {
    return NextResponse.json(
      { error: "GATEWAY_SSO_SERVER_SECRET 未配置" },
      { status: 503 },
    );
  }

  let body: { phone?: unknown; purpose?: unknown } = {};
  try {
    body = (await request.json()) as { phone?: unknown; purpose?: unknown };
  } catch {
    return NextResponse.json({ error: "无效请求" }, { status: 400 });
  }
  const phone = typeof body.phone === "string" ? body.phone : "";
  if (!phone.trim()) {
    return NextResponse.json({ error: "请输入手机号" }, { status: 400 });
  }
  const purpose =
    body.purpose === "REGISTER" || body.purpose === "LOGIN"
      ? body.purpose
      : "LOGIN";

  let upstream: Response;
  try {
    upstream = await fetchBookMall(`${base}/api/sso/portal/sms/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
        ...(request.headers.get("x-forwarded-for")
          ? { "x-platform-client-ip": request.headers.get("x-forwarded-for")!.split(",")[0]!.trim() }
          : request.headers.get("x-real-ip")
            ? { "x-platform-client-ip": request.headers.get("x-real-ip")!.trim() }
            : {}),
      },
      body: JSON.stringify({ phone, purpose }),
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: "book_mall_unreachable", message: bookMallFetchErrorMessage(e) },
      { status: 503 },
    );
  }

  const data = (await upstream.json().catch(() => null)) as
    | { ok?: boolean; error?: string; mockCode?: string }
    | null;
  return NextResponse.json(data ?? { error: "发送失败" }, {
    status: upstream.status,
  });
}
