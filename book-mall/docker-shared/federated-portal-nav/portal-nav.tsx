"use client";

import type { PortalKey, PortalNavItem } from "./portal-nav-items";
import { buildPortalNavItems } from "./portal-nav-items";

export type PortalNavVariant = "light" | "dark" | "canvas" | "story" | "quick-replica";

const VARIANT_CLASS: Record<
  PortalNavVariant,
  { active: string; idle: string; disabled: string }
> = {
  light: {
    active: "bg-[#f5f5f7] text-[#1d1d1f]",
    idle: "text-[#6e6e73] hover:bg-[#f5f5f7]",
    disabled: "text-[#86868b]",
  },
  dark: {
    active: "bg-white/15 text-white ring-1 ring-white/20",
    idle: "text-white/80 hover:bg-white/10 hover:text-white",
    disabled: "text-white/45",
  },
  canvas: {
    active: "bg-[var(--canvas-accent)]/15 text-[var(--canvas-accent)]",
    idle: "text-[var(--canvas-muted)] hover:bg-white/5",
    disabled: "text-[var(--canvas-muted)]",
  },
  story: {
    active: "bg-white/10 text-white",
    idle: "text-white/60 hover:bg-white/5 hover:text-white",
    disabled: "text-white/35",
  },
  "quick-replica": {
    active: "bg-white/10 text-[var(--qr-text-primary)]",
    idle: "text-[var(--qr-text-muted)] hover:bg-white/5",
    disabled: "text-[var(--qr-text-muted)]",
  },
};

export type FederatedPortalNavProps = {
  current: PortalKey;
  bookOrigin: string | null;
  variant?: PortalNavVariant;
  className?: string;
  /** 非当前站点链接在新标签打开（默认 true） */
  openOthersInNewTab?: boolean;
};

function NavLink({
  item,
  isCurrent,
  styles,
  openOthersInNewTab,
}: {
  item: PortalNavItem;
  isCurrent: boolean;
  styles: (typeof VARIANT_CLASS)[PortalNavVariant];
  openOthersInNewTab: boolean;
}) {
  const base = `shrink-0 rounded-full px-3 py-1.5 transition ${isCurrent ? styles.active : styles.idle}`;

  if (!item.href) {
    return (
      <span className={`${base} ${styles.disabled}`}>{item.label}</span>
    );
  }

  if (isCurrent) {
    return (
      <span className={base} aria-current="page">
        {item.label}
      </span>
    );
  }

  return (
    <a
      href={item.href}
      className={base}
      {...(openOthersInNewTab
        ? { target: "_blank", rel: "noopener noreferrer" }
        : {})}
    >
      {item.label}
    </a>
  );
}

/** 跨门户顶栏导航（六站 federated 菜单 · 共用实现） */
export function FederatedPortalNav({
  current,
  bookOrigin,
  variant = "light",
  className = "",
  openOthersInNewTab = true,
}: FederatedPortalNavProps) {
  const items = buildPortalNavItems(bookOrigin);
  const styles = VARIANT_CLASS[variant];

  return (
    <nav
      className={`flex flex-nowrap items-center justify-center gap-1 text-sm ${className}`.trim()}
    >
      {items.map((it) => (
        <NavLink
          key={it.key}
          item={it}
          isCurrent={it.key === current}
          styles={styles}
          openOthersInNewTab={openOthersInNewTab}
        />
      ))}
    </nav>
  );
}
