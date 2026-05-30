import Link from "next/link";

function hintForReason(reason: string): string {
  if (reason === "exchange_403") {
    return "当前账号不满足工具站准入（须有效工具技术服务费或管理员）。";
  }
  if (reason === "missing_main_origin") {
    return "未配置 MAIN_SITE_ORIGIN 或 NEXT_PUBLIC_BOOK_MALL_URL。";
  }
  if (reason === "missing_exchange_secret") {
    return "未配置 TOOLS_SSO_SERVER_SECRET（长度 ≥16）。";
  }
  if (reason === "exchange_401") {
    return "子站调用主站 exchange 时 Bearer 密钥被拒：请确认 canvas-web 与 book-mall 的 TOOLS_SSO_SERVER_SECRET 完全一致（生产环境在云托管两侧分别配置后重启服务）。";
  }
  return "请从主站「打开画布」重新发起 SSO，并确认主站与子站 TOOLS_SSO_* 密钥一致。";
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
        <Link href="/projects" className="underline">
          返回项目列表
        </Link>
      </p>
    </main>
  );
}
