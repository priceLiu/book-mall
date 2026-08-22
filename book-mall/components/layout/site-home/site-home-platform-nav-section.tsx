import Link from "next/link";

import { SiteHomePlatformAppCardRotator } from "@/components/layout/site-home/site-home-platform-app-card-rotator";
import type { SiteHomePlatformAppSnapshot } from "@/lib/static-snapshots/site-home-payload";

export function SiteHomePlatformNavSection({
  platformApps,
}: {
  platformApps: SiteHomePlatformAppSnapshot[];
}) {
  if (platformApps.length === 0) return null;

  const primaryRow = platformApps.slice(0, 5);
  const secondaryRow = platformApps.slice(5);

  return (
    <section id="platform-apps" className="site-home-platform-nav py-16 sm:py-20">
      <div className="site-home-platform-nav-inner site-marketing-section">
        <div className="site-home-platform-nav-header mb-8 flex flex-col gap-2 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
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

        <div className="site-home-platform-nav-grid site-home-platform-nav-grid--compact xl:hidden">
          {platformApps.map((app) => (
            <SiteHomePlatformAppCardRotator key={app.key} app={app} />
          ))}
        </div>

        <div className="hidden xl:flex xl:flex-col xl:gap-5">
          <div className="site-home-platform-nav-grid site-home-platform-nav-grid--primary">
            {primaryRow.map((app) => (
              <SiteHomePlatformAppCardRotator key={app.key} app={app} />
            ))}
          </div>
          {secondaryRow.length > 0 ? (
            <div className="site-home-platform-nav-grid site-home-platform-nav-grid--secondary">
              {secondaryRow.map((app) => (
                <SiteHomePlatformAppCardRotator key={app.key} app={app} />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
