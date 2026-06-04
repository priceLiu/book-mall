import Link from "next/link";

function hintForReason(reason: string): string {
  if (reason === "missing_exchange_secret") {
    return "子站未配置 TOOLS_SSO_SERVER_SECRET（≥16 字符）。本地开发请确保 book-mall/.env.local 已配置，并用 pnpm dev（会自动从主站继承）；或复制到 e-commerce-toolkit/.env.local。";
  }
  if (reason === "missing_main_origin") {
    return "未配置 MAIN_SITE_ORIGIN 或 NEXT_PUBLIC_BOOK_MALL_URL。";
  }
  if (reason === "exchange_403") {
    return "当前账号不满足电商工具箱准入（须有效月费、代付模式或管理员）。";
  }
  if (reason.startsWith("exchange_")) {
    return "主站 exchange 失败。请从个人中心「打开电商工具箱」重新登录，并确认主站与子站 SSO 密钥一致。";
  }
  return "请从主站个人中心重新打开电商工具箱。";
}

export default function SsoErrorPage({
  searchParams,
}: {
  searchParams: { reason?: string };
}) {
  const reason = searchParams.reason ?? "unknown";
  return (
    <div className="mx-auto max-w-lg px-6 py-24 text-center">
      <h1 className="text-2xl font-semibold">登录未完成</h1>
      <p className="mt-4 text-sm text-[var(--ecom-muted)]">
        原因：<code className="text-foreground">{reason}</code>
      </p>
      <p className="mt-3 text-sm leading-relaxed text-[var(--ecom-muted)]">
        {hintForReason(reason)}
      </p>
      <Link href="/" className="mt-8 inline-block text-[var(--ecom-primary)] hover:underline">
        返回首页
      </Link>
    </div>
  );
}
