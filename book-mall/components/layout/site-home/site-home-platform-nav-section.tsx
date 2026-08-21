import Link from "next/link";

import { Icon } from "@/components/ui/icon";
import {
  buildSiteHomePlatformApps,
  type SiteHomePlatformApp,
} from "@/lib/site-home/platform-apps";

function PlatformAppCard({ app }: { app: SiteHomePlatformApp }) {
  return (
    <Link
      href={app.href}
      className="site-home-platform-app-card group flex w-[220px] shrink-0 snap-start flex-col rounded-xl border border-border bg-card p-4 transition hover:border-foreground/20 hover:shadow-md sm:w-[240px]"
    >
      <div className="mb-3 flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground/80 transition group-hover:bg-foreground/5">
          <Icon name={app.icon} size={20} className="text-foreground/75" />
        </span>
        <h3 className="text-sm font-semibold leading-snug text-foreground">{app.label}</h3>
      </div>
      <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
        {app.tagline}
      </p>
    </Link>
  );
}

export function SiteHomePlatformNavSection() {
  const apps = buildSiteHomePlatformApps();
  if (apps.length === 0) return null;

  return (
    <section id="platform-apps" className="site-home-platform-nav">
      <div className="site-home-platform-nav-inner site-marketing-section">
        <div className="site-home-platform-nav-header mb-5 flex flex-col gap-2 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg md:text-xl">平台应用</h2>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">
              一处登录，全站互通。选一个入口，直接进入创作。
            </p>
          </div>
          <Link
            href="/products/ai-apps"
            className="shrink-0 text-sm font-medium text-foreground underline-offset-4 hover:underline"
          >
            查看全部应用 →
          </Link>
        </div>
        <div className="site-home-platform-nav-track">
          <div className="site-home-platform-nav-scroll flex gap-4 pb-1 sm:gap-5">
            {apps.map((app) => (
              <PlatformAppCard key={app.key} app={app} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
