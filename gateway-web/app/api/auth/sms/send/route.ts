import { NextResponse, type NextRequest } from "next/server";
import { getBookMallOrigin } from "@/lib/book-mall-base-url";
import { bookMallFetchErrorMessage, fetchBookMall } from "@/lib/fetch-book-mall";

export const dynamic = "force-dynamic";

/** 透传到 book-mall 短信发送：强制 purpose=LOGIN，避免被用作其他用途。 */
export async function POST(request: NextRequest) {
  const base = getBookMallOrigin();
  if (!base) {
    return NextResponse.json({ error: "BOOK_MALL_ORIGIN 未配置" }, { status: 503 });
  }

  let phone = "";
  try {
    const body = (await request.json()) as { phone?: unknown };
    if (typeof body?.phone === "string") phone = body.phone;
  } catch {
    return NextResponse.json({ error: "无效请求" }, { status: 400 });
  }
  if (!phone.trim()) {
    return NextResponse.json({ error: "请输入手机号" }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetchBookMall(`${base}/api/auth/sms/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, purpose: "LOGIN" }),
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
