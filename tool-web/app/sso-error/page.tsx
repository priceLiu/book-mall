import Link from "next/link";

export default function SsoErrorPage({
  searchParams,
}: {
  searchParams: { reason?: string };
}) {
  const reason = searchParams.reason ?? "unknown";
  return (
    <main>
      <h1>SSO 失败</h1>
      <p>
        原因代码：<code>{reason}</code>
      </p>
      <p>
        请确认主站已启动、环境变量 <code>MAIN_SITE_ORIGIN</code> 与主站{" "}
        <code>TOOLS_*</code> 一致，且你已是黄金会员。
      </p>
      <p>
        <Link href="/">返回首页</Link>
      </p>
    </main>
  );
}
