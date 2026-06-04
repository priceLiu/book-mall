import Link from "next/link";

/** 窄屏：侧栏隐藏时的顶栏入口 */
export function EcomMobileBar() {
  return (
    <header className="flex h-11 shrink-0 items-center justify-between border-b border-[var(--ecom-hairline)] bg-white px-4 md:hidden">
      <Link href="/" className="text-sm font-semibold text-[var(--ecom-ink)]">
        电商工具箱
      </Link>
      <div className="flex items-center gap-4 text-xs text-[var(--ecom-muted)]">
        <Link href="/library" className="hover:text-[var(--ecom-ink)]">
          我的资产
        </Link>
        <Link href="/ecom/main-image" className="hover:text-[var(--ecom-ink)]">
          主图
        </Link>
      </div>
    </header>
  );
}
