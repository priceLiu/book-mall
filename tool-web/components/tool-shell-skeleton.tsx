/** 根布局 Suspense fallback：首屏先出壳层，避免白屏等待主站 introspect */
import { ToolSkeletonGearCluster } from "@/components/tool-skeleton-gears";

export function ToolShellSkeleton() {
  return (
    <div className="tool-root" role="status" aria-busy={true} aria-label="加载工具站">
      <aside className="tool-sidebar" aria-hidden>
        <div className="tool-sidebar-head">
          <div className="tool-skel tool-skel-brand" />
        </div>
        <nav className="tool-sidebar-body">
          <div className="tool-sk-gears-host tool-sk-gears-host--sidebar">
            <ToolSkeletonGearCluster variant="sidebar" />
          </div>
          <hr className="tool-sidebar-divider tool-sidebar-divider--skeleton" aria-hidden />
          <div className="tool-skel tool-skel-line tool-skel-line--short" />
          <div className="tool-skel tool-skel-line" />
          <div className="tool-skel tool-skel-line tool-skel-line--short" />
        </nav>
      </aside>

      <div className="tool-column">
        <header className="tool-topbar">
          <div className="tool-menu-btn tool-skel tool-skel-btn" aria-hidden />
          <div className="tool-topbar-fill" />
          <div className="tool-user tool-user--skeleton">
            <div className="tool-sk-gears-host tool-sk-gears-host--topbar">
              <ToolSkeletonGearCluster variant="sidebar" />
            </div>
          </div>
        </header>

        <main className="tool-main-scroll">
          <div className="tw-main tool-skel-page tool-skel-page--gears">
            <div className="tool-sk-gears-host tool-sk-gears-host--hero">
              <ToolSkeletonGearCluster variant="hero" />
              <p className="tool-sk-gears-caption">正在同步会话…</p>
            </div>
            <div className="tool-skel tool-skel-line tool-skel-line--muted tool-skel-line--below-gears" />
          </div>
        </main>
      </div>
    </div>
  );
}
