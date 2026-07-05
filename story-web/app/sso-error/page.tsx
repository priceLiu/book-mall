import Link from "next/link";

function hintForReason(reason: string): string {
  if (reason === "exchange_403") {
    return "当前账号不满足工具站准入（须有效工具技术服务费或管理员）。";
  }
  if (reason === "missing_main_origin") {
    return "未配置 MAIN_SITE_ORIGIN 或 NEXT_PUBLIC_BOOK_MALL_URL。";
  }
  if (reason === "missing_exchange_secret") {
    return (
      "story-web 运行时未读到有效的 TOOLS_SSO_SERVER_SECRET（长度须 ≥16）。" +
      "请在 CloudBase 的 story-web 服务（不是 book-mall）配置该变量，与主站完全一致，保存后重新部署/重启。" +
      "可用 GET /api/sso-config-health 查看当前容器内 exchangeSecretLength。"
    );
  }
  return "请从主站「打开漫剧」重新发起 SSO，并确认主站与子站 TOOLS_SSO_* 密钥一致。";
}

export default function SsoErrorPage({
  searchParams,
}: {
  searchParams: { reason?: string };
}) {
  const reason = searchParams.reason ?? "unknown";
  return (
    <main className="mx-auto max-w-lg p-8">
      <h1 className="text-xl font-semibold">SSO 失败</h1>
      <p className="mt-2 text-muted-foreground">
        原因：<code>{reason}</code>
      </p>
      <p className="mt-2">{hintForReason(reason)}</p>
      <p className="mt-4">
        <Link href="/" className="underline">
          返回首页
        </Link>
      </p>
    </main>
  );
}
