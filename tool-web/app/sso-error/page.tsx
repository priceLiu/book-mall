import Link from "next/link";

function hintForReason(reason: string): string {
  if (reason === "exchange_401") {
    return "主站校验换票密钥失败：请核对工具站与主站环境变量 TOOLS_SSO_SERVER_SECRET 是否完全一致（长度 ≥16、无首尾空格、无引号）。与黄金会员无关。";
  }
  if (reason === "exchange_403") {
    return "主站已校验密钥，但当前账号不满足工具站准入（须黄金会员或管理员），或授权码已被消耗。";
  }
  if (reason.startsWith("exchange_")) {
    return "换票接口返回异常 HTTP 状态，请核对 MAIN_SITE_ORIGIN 是否指向当前线上主站，主站服务是否正常。";
  }
  if (reason === "missing_main_origin") {
    return "工具站未配置 MAIN_SITE_ORIGIN（须与浏览器访问主站的 Origin 一致）。";
  }
  if (reason === "missing_exchange_secret") {
    return "工具站未配置 TOOLS_SSO_SERVER_SECRET 或长度不足 16。";
  }
  if (reason === "missing_code") {
    return "回调 URL 缺少一次性 code，请从主站「进入工具站」重新发起跳转。";
  }
  return "请确认主站已启动、MAIN_SITE_ORIGIN 正确，且工具站与主站的 TOOLS_SSO_* 密钥一致；普通用户需满足黄金会员条件。";
}

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
      <p>{hintForReason(reason)}</p>
      <p>
        <Link href="/">返回首页</Link>
      </p>
    </main>
  );
}
