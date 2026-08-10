import Link from "next/link";

/** 窄屏：本应用内快捷入口（跨门户菜单在 EcomPortalTopBar） */
export function EcomMobileBar() {
  return (
    <header className="flex h-11 shrink-0 items-center justify-between border-b border-[var(--ecom-hairline)] bg-white px-4 md:hidden">
      <Link href="/" className="text-sm font-semibold text-[var(--ecom-ink)]">
        工作台
      </Link>
      <div className="flex items-center gap-3 overflow-x-auto text-xs text-[var(--ecom-muted)] sm:gap-4">
        <Link href="/library" className="shrink-0 hover:text-[var(--ecom-ink)]">
          我的资产
        </Link>
        <Link href="/ecom/main-image" className="shrink-0 hover:text-[var(--ecom-ink)]">
          主图
        </Link>
      </div>
    </header>
  );
}
