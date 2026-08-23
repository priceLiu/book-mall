import { Sparkles } from "lucide-react";
import { qrLoginHref, qrRegisterHref } from "@/lib/portal-auth-links";
import { QrLandingHome } from "@/components/qr-landing-home";

/** 公开落地页（可被搜索引擎收录）；未登录访问 `/` 时展示。 */
export function QrLanding() {
  return (
    <main className="flex h-dvh flex-col overflow-y-auto bg-[var(--qr-bg-page)]">
      <header className="mx-auto w-full max-w-6xl shrink-0 px-4 pt-6 sm:px-6 sm:pt-8">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-6 w-6" style={{ color: "var(--qr-brand)" }} />
            <span className="text-xl font-semibold text-[var(--qr-text-primary)]">
              QuickReplica 快速复刻
            </span>
          </div>
          <div className="flex shrink-0 gap-2">
            <a href={qrLoginHref("/")} className="qr-btn-secondary">
              登录
            </a>
            <a href={qrRegisterHref("/")} className="qr-btn-primary">
              免费注册
            </a>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">
        <QrLandingHome />
      </div>
    </main>
  );
}
