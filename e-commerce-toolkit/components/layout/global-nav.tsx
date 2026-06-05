import Link from "next/link";
import { getMainSiteOrigin } from "@/lib/site-origin";

export function GlobalNav() {
  const book = getMainSiteOrigin() ?? "http://localhost:3000";

  return (
    <nav className="flex h-11 shrink-0 items-center justify-between bg-black px-6 text-xs text-white">
      <div className="flex items-center gap-5">
        <Link href="/" className="font-semibold tracking-tight">
          电商工具箱
        </Link>
        <Link href="/library" className="opacity-80 hover:opacity-100">
          我的资产
        </Link>
      </div>
      <div className="flex items-center gap-4">
        <a
          href={`${book}/account`}
          className="opacity-80 hover:opacity-100"
          target="_blank"
          rel="noopener noreferrer"
        >
          个人中心
        </a>
        <a
          href={`${book}/ecom-open?path=${encodeURIComponent("/")}`}
          className="rounded-lg bg-[var(--ecom-ink)] px-[15px] py-2 text-sm text-white"
        >
          登录
        </a>
      </div>
    </nav>
  );
}
