export const dynamic = "force-dynamic";

const REASON_TEXT: Record<string, string> = {
  missing_code: "缺少 SSO 授权码，请从主站重新进入。",
  missing_main_origin: "未配置主站地址（MAIN_SITE_ORIGIN）。",
  missing_exchange_secret: "未配置 SSO 交换密钥（TOOLS_SSO_SERVER_SECRET）。",
  no_token: "主站未返回访问令牌。",
};

export default function SsoErrorPage({
  searchParams,
}: {
  searchParams: { reason?: string };
}) {
  const reason = searchParams.reason ?? "unknown";
  const text = REASON_TEXT[reason] ?? `SSO 登录失败（${reason}）。`;
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        color: "#e5e7eb",
        fontFamily: "system-ui, sans-serif",
        background: "#090909",
      }}
    >
      <h1 style={{ fontSize: 20, fontWeight: 600 }}>无法进入 3D导演台</h1>
      <p style={{ color: "#9ca3af" }}>{text}</p>
    </main>
  );
}
