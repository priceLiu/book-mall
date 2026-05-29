import { NextResponse, type NextRequest } from "next/server";
import {
  GATEWAY_TOKEN_COOKIE,
  getBookMallOrigin,
} from "@/lib/book-mall-base-url";
import { bookMallFetchErrorMessage, fetchBookMall } from "@/lib/fetch-book-mall";

export const dynamic = "force-dynamic";

function setGatewayToken(
  res: NextResponse,
  token: string,
  maxAge: number,
): void {
  res.cookies.set(GATEWAY_TOKEN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge,
    secure: process.env.NODE_ENV === "production",
  });
}

export function clearGatewayToken(res: NextResponse): void {
  res.cookies.set(GATEWAY_TOKEN_COOKIE, "", {
    path: "/",
    maxAge: 0,
  });
}

export async function proxyBookMallAuth(
  request: NextRequest,
  path: string,
): Promise<NextResponse> {
  const base = getBookMallOrigin();
  if (!base) {
    return NextResponse.json({ error: "BOOK_MALL_ORIGIN 未配置" }, { status: 503 });
  }

  const body = await request.text();
  let upstream: Response;
  try {
    upstream = await fetchBookMall(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      {
        error: "book_mall_unreachable",
        message: bookMallFetchErrorMessage(e),
      },
      { status: 503 },
    );
  }

  const data = (await upstream.json().catch(() => null)) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
  } | null;

  if (!upstream.ok) {
    return NextResponse.json(
      { error: data?.error ?? "登录失败" },
      { status: upstream.status },
    );
  }

  const token =
    typeof data?.access_token === "string" ? data.access_token : null;
  if (!token) {
    return NextResponse.json({ error: "未返回 token" }, { status: 502 });
  }

  const expiresIn =
    typeof data?.expires_in === "number" && data.expires_in > 0
      ? data.expires_in
      : 86400;

  const res = NextResponse.json({ ok: true });
  setGatewayToken(res, token, expiresIn);
  return res;
}

export { setGatewayToken };
