import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * 本地开发：由 finance-web 服务端代请求 book-mall，避免浏览器从 :3002 跨域带 Cookie 到 :3000 失败。
 * 依赖 book-mall `FINANCE_ALLOW_DEV_USER_QUERY=1` 与 URL 参数 devUserId（非 production）。
 *
 * 生产环境：本路由返回 404；生产应使用同域/网关或正式登录态。
 */
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const base = (
    process.env.BOOK_MALL_URL ||
    process.env.NEXT_PUBLIC_BOOK_MALL_URL ||
    ""
  ).replace(/\/$/, "");
  const devUserId = process.env.FINANCE_DEV_USER_ID?.trim();

  if (!base) {
    return NextResponse.json(
      {
        error: "book_mall_url_missing",
        hint: "请设置 BOOK_MALL_URL 或 NEXT_PUBLIC_BOOK_MALL_URL（如 http://localhost:3000）",
      },
      { status: 503 },
    );
  }

  if (!devUserId) {
    return NextResponse.json(
      {
        error: "finance_dev_user_id_missing",
        hint:
          "请在 finance-web .env.local 设置 FINANCE_DEV_USER_ID=<book-mall 的 User.id>；主站 .env.local 设置 FINANCE_ALLOW_DEV_USER_QUERY=1。可用 cd book-mall && pnpm billing:print-dev-user 查看示例 id。",
      },
      { status: 503 },
    );
  }

  const url = `${base}/api/account/billing-detail-lines?devUserId=${encodeURIComponent(devUserId)}`;

  try {
    const r = await fetch(url, { cache: "no-store" });
    const text = await r.text();
    return new NextResponse(text, {
      status: r.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const detail = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        error: "upstream_fetch_failed",
        hint: `无法连接主站 ${base}（请确认 book-mall 已启动）：${detail}`,
      },
      { status: 502 },
    );
  }
}
