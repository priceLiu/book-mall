import { QrLandingHome } from "@/components/qr-landing-home";
import { QrPortalTopBar } from "@/components/qr-portal-top-bar";

/** 公开落地页（可被搜索引擎收录）；未登录访问 `/` 时展示。 */
export function QrLanding() {
  return (
    <main className="flex h-dvh flex-col overflow-y-auto bg-[var(--qr-bg-page)]">
      <QrPortalTopBar authed={false} />

      <div className="flex min-h-0 flex-1 flex-col">
        <QrLandingHome />
      </div>
    </main>
  );
}
