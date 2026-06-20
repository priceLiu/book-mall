import Link from "next/link";

export default function SsoErrorPage({
  searchParams,
}: {
  searchParams: { reason?: string };
}) {
  const reason = searchParams.reason ?? "unknown";
  return (
    <div className="po-shell">
      <main className="po-main">
        <div className="po-card">
          <h1 style={{ marginTop: 0, fontSize: 18 }}>登录失败</h1>
          <p className="po-muted">
            SSO 未能完成（<code>{reason}</code>）。请确认主站与平台壳环境变量一致。
          </p>
          <p style={{ marginTop: 16 }}>
            <Link href="/" className="po-btn">
              返回首页
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
