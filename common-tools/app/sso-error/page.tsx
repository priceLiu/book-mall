import Link from "next/link";

import { buildLoginUrl } from "@/lib/auth";

function hintForReason(reason: string): string {
  if (reason === "missing_exchange_secret") {
    return "子站未配置 TOOLS_SSO_SERVER_SECRET（≥16 字符）。本地开发请确保 book-mall/.env.local 已配置，并用 pnpm dev 启动。";
  }
  if (reason === "missing_main_origin") {
    return "子站运行时未读到主站地址。本地请配置 MAIN_SITE_ORIGIN=http://localhost:3000。";
  }
  if (reason.startsWith("exchange_")) {
    return "主站 exchange 失败。请从主站重新打开常用工具，并确认 SSO 密钥一致。";
  }
  return "请从主站重新打开常用工具。";
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
      <p className="mt-4 text-sm text-[#6e6e73]">
        原因：<code className="text-[#1d1d1f]">{reason}</code>
      </p>
      <p className="mt-3 text-sm leading-relaxed text-[#6e6e73]">
        {hintForReason(reason)}
      </p>
      <div className="mt-8 flex flex-col items-center gap-3">
        <a
          href={buildLoginUrl("/")}
          className="inline-flex rounded-full bg-[#1d1d1f] px-6 py-2.5 text-sm font-medium text-white hover:bg-black"
        >
          重新登录
        </a>
        <Link href="/" className="text-sm text-[#0071e3] hover:underline">
          返回首页
        </Link>
      </div>
    </div>
  );
}
