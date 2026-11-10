"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import {
  BOOK_PORTAL_EXTERNAL_LINK_PROPS,
  buildBookPortalNavItems,
} from "@/lib/portal-nav";
import {
  HOME_V2_ANCHORS,
  homeV2CanvasHref,
} from "@/lib/site-home-v2/links";
import {
  type HomeV2NavSectionId,
  useHomeV2NavHighlight,
} from "./use-home-v2-nav-highlight";

function NavChevron() {
  return (
    <svg
      className="nav-chevron"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      aria-hidden
      style={{ width: 12, height: 12 }}
    >
      <path d="M2.5 4.5 6 8l3.5-3.5" />
    </svg>
  );
}

const SECTION_LINKS = [
  { label: "主屏", href: HOME_V2_ANCHORS.top, sectionId: "top" as const },
  { label: "五大场景", href: HOME_V2_ANCHORS.scenes, sectionId: "scenes" as const },
  { label: "官方技能", href: HOME_V2_ANCHORS.skills, sectionId: "skills" as const },
  {
    label: "一键复刻",
    href: HOME_V2_ANCHORS.quickReplica,
    sectionId: "quick-replica-showcase" as const,
  },
  { label: "客户评价", href: HOME_V2_ANCHORS.why, sectionId: "why" as const },
  { label: "订阅价格", href: HOME_V2_ANCHORS.pricing, isRoute: true as const },
  { label: "API 价格", href: HOME_V2_ANCHORS.apiPricing, isRoute: true as const },
];

function sectionIdFromHash(hash: string): HomeV2NavSectionId | null {
  const id = hash.replace(/^#/, "");
  if (id === "top" || id === "") return "top";
  if (id === "quick-replica-showcase") return "quick-replica-showcase";
  if (SECTION_LINKS.some((l) => "sectionId" in l && l.sectionId === id)) {
    return id as HomeV2NavSectionId;
  }
  if (id === "pricing" || id === "api-pricing") return "cta";
  return null;
}

export function SiteHomeV2Nav({
  isLoggedIn,
  authSlot,
}: {
  isLoggedIn: boolean;
  authSlot: React.ReactNode;
}) {
  const pathname = usePathname();
  const onHomeV2 = pathname === "/home-v2";
  const menuId = useId();
  const mobileId = useId();
  const dropdownRef = useRef<HTMLLIElement>(null);
  const [productOpen, setProductOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const scrollActive = useHomeV2NavHighlight(onHomeV2);
  const [hashSection, setHashSection] = useState<HomeV2NavSectionId | null>(null);

  const portalItems = buildBookPortalNavItems(undefined, isLoggedIn);

  useEffect(() => {
    setProductOpen(false);
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!onHomeV2) return;
    const read = () => setHashSection(sectionIdFromHash(window.location.hash));
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, [onHomeV2, pathname]);

  useEffect(() => {
    if (!productOpen) return;
    const onPointer = (e: MouseEvent) => {
      if (!dropdownRef.current?.contains(e.target as Node)) {
        setProductOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [productOpen]);

  const activeSection = hashSection ?? scrollActive;

  const anchorHref = (hash: string) => `/home-v2${hash}`;

  const navLinkClass = (active: boolean) => (active ? "is-active" : undefined);

  const homeHref = onHomeV2 ? anchorHref(HOME_V2_ANCHORS.top) : "/home-v2";

  const brandLink = (
    <Link className="nav-brand" href={homeHref} aria-label="智选首页">
      <span className="nav-brand-mark" aria-hidden>
        智
      </span>
      <span className="nav-brand-name">智选</span>
    </Link>
  );

  return (
    <header className="site-header site-header--apple">
      <div className="apple-nav-inner">
        <div className="nav-brand-mobile">{brandLink}</div>

        <div className="apple-nav-cluster">
          <div className="nav-group nav-group--brand">{brandLink}</div>

          <ul className="nav-links nav-group--menu" aria-label="主导航">
          <li className="has-dropdown" ref={dropdownRef}>
            <button
              className={`nav-trigger${productOpen ? " is-active" : ""}`}
              type="button"
              aria-expanded={productOpen}
              aria-controls={menuId}
              id={`${menuId}-trigger`}
              onClick={() => setProductOpen((v) => !v)}
            >
              产品应用
              <NavChevron />
            </button>
            <div
              className={`nav-dropdown${productOpen ? " is-open" : ""}`}
              id={menuId}
              role="menu"
              aria-labelledby={`${menuId}-trigger`}
            >
              {portalItems.map((item) => (
                <a
                  key={item.key}
                  role="menuitem"
                  href={item.href}
                  {...BOOK_PORTAL_EXTERNAL_LINK_PROPS}
                  onClick={() => setProductOpen(false)}
                >
                  {item.label}
                </a>
              ))}
            </div>
          </li>
          {SECTION_LINKS.map((link) => {
            if ("isRoute" in link && link.isRoute) {
              const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
              return (
                <li key={link.href}>
                  <Link href={link.href} className={navLinkClass(active)} aria-current={active ? "page" : undefined}>
                    {link.label}
                  </Link>
                </li>
              );
            }
            const active = onHomeV2 && activeSection === link.sectionId;
            return (
              <li key={link.href}>
                <Link
                  href={anchorHref(link.href)}
                  className={navLinkClass(active)}
                  aria-current={active ? "page" : undefined}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
          </ul>

          <div className="nav-group nav-group--account">
            {authSlot}
            <a
              className="apple-nav-link apple-nav-link--cta home-v2-auth-hide-mobile"
              href={homeV2CanvasHref()}
              {...BOOK_PORTAL_EXTERNAL_LINK_PROPS}
            >
              开始创作
            </a>
          </div>
        </div>

        <button
          className="nav-toggle"
          type="button"
          aria-expanded={mobileOpen}
          aria-controls={mobileId}
          aria-label={mobileOpen ? "关闭菜单" : "打开菜单"}
          onClick={() => setMobileOpen((v) => !v)}
        >
          <span className="nav-toggle-bars" aria-hidden>
            <span />
            <span />
            <span />
          </span>
        </button>
      </div>

      {mobileOpen ? (
        <div className="mobile-nav mobile-nav--apple" id={mobileId}>
          <nav aria-label="移动导航">
            <p className="mobile-nav-label">产品应用</p>
            {portalItems.map((item) => (
              <a
                key={item.key}
                href={item.href}
                {...BOOK_PORTAL_EXTERNAL_LINK_PROPS}
                onClick={() => setMobileOpen(false)}
              >
                {item.label}
              </a>
            ))}
            <hr className="my-2 border-[var(--border-soft)]" />
            {SECTION_LINKS.map((link) => {
              if ("isRoute" in link && link.isRoute) {
                return (
                  <Link key={link.href} href={link.href} onClick={() => setMobileOpen(false)}>
                    {link.label}
                  </Link>
                );
              }
              return (
                <Link
                  key={link.href}
                  href={anchorHref(link.href)}
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </Link>
              );
            })}
            <a
              className="apple-nav-link apple-nav-link--cta"
              href={homeV2CanvasHref()}
              {...BOOK_PORTAL_EXTERNAL_LINK_PROPS}
              onClick={() => setMobileOpen(false)}
            >
              开始创作
            </a>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
