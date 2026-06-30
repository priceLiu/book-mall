"use client";

import {
  Clapperboard,
  FolderOpen,
  Globe,
  History,
  Home,
  ImageIcon,
  Settings2,
  Smile,
  Video,
  Volume2,
  X,
} from "lucide-react";

import {
  QR_CATEGORIES,
  QR_PINNED_TOOLS,
  type QrCategory,
} from "@/lib/qr-template-types";

export type QrNavMode =
  | "home"
  | "category"
  | "my-works"
  | "generate-history"
  | "pinned-tool"
  | "admin";

const CATEGORY_ICONS: Record<QrCategory, typeof Video> = {
  video: Video,
  image: ImageIcon,
  character: Smile,
  world: Globe,
  audio: Volume2,
};

type Props = {
  navMode: QrNavMode;
  category: QrCategory;
  pinnedToolKey: string | null;
  sidebarOpen: boolean;
  canManageFeatured?: boolean;
  onCloseSidebar: () => void;
  onHome: () => void;
  onCategory: (category: QrCategory) => void;
  onMyWorks: () => void;
  onGenerateHistory?: () => void;
  onPinnedTool: (toolKey: string, category: QrCategory, kind: string) => void;
  onAdmin?: () => void;
};

export function QrSidebar({
  navMode,
  category,
  pinnedToolKey,
  sidebarOpen,
  canManageFeatured = false,
  onCloseSidebar,
  onHome,
  onCategory,
  onMyWorks,
  onGenerateHistory,
  onPinnedTool,
  onAdmin,
}: Props) {
  return (
    <>
      <aside
        className={`${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } fixed inset-y-0 left-0 z-40 flex w-56 flex-col border-r p-3 transition lg:static lg:translate-x-0`}
        style={{
          borderColor: "var(--qr-border)",
          background: "var(--qr-bg-surface)",
        }}
      >
        <div className="mb-3 flex items-center justify-between lg:hidden">
          <span className="text-sm font-medium">菜单</span>
          <button type="button" onClick={onCloseSidebar}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <button
          type="button"
          className={`mb-4 flex w-full items-center gap-2 px-2 py-2 text-sm transition ${
            navMode === "home" ? "qr-nav-active" : "text-[var(--qr-text-secondary)] hover:bg-white/[0.06] hover:text-[var(--qr-text-primary)]"
          }`}
          onClick={() => {
            onHome();
            onCloseSidebar();
          }}
        >
          <Home className="h-4 w-4" /> 首页
        </button>

        <div className="mb-2 text-xs uppercase tracking-wide qr-panel-muted">创造</div>
        <div className="grid grid-cols-2 gap-2">
          {QR_CATEGORIES.map((c) => {
            const Icon = CATEGORY_ICONS[c.id];
            const active = navMode === "category" && category === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  onCategory(c.id);
                  onCloseSidebar();
                }}
                className={`flex items-center gap-2 rounded-lg border px-2 py-2 text-xs transition ${
                  active
                    ? "qr-nav-category-active"
                    : "border-[var(--qr-border)] text-[var(--qr-text-secondary)] hover:border-white/20"
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                {c.label}
              </button>
            );
          })}
        </div>

        <div className="mt-6 mb-2 text-xs uppercase tracking-wide qr-panel-muted">
          已置顶工具
        </div>
        <div className="space-y-1">
          {QR_PINNED_TOOLS.map((t) => (
            <button
              key={t.toolKey}
              type="button"
              onClick={() => {
                onPinnedTool(t.toolKey, t.category, t.kind);
                onCloseSidebar();
              }}
              className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition ${
                navMode === "pinned-tool" && pinnedToolKey === t.toolKey
                  ? "qr-nav-active"
                  : "text-[var(--qr-text-secondary)] hover:bg-white/[0.06] hover:text-[var(--qr-text-primary)]"
              }`}
            >
              <Clapperboard className="h-4 w-4 shrink-0" />
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-auto space-y-1 pt-4">
          {canManageFeatured && onAdmin ? (
            <>
              <div className="mb-2 text-xs uppercase tracking-wide qr-panel-muted">管理</div>
              <button
                type="button"
                onClick={() => {
                  onAdmin();
                  onCloseSidebar();
                }}
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm transition ${
                  navMode === "admin"
                    ? "qr-nav-active"
                    : "text-[var(--qr-text-secondary)] hover:bg-white/[0.06] hover:text-[var(--qr-text-primary)]"
                }`}
              >
                <Settings2 className="h-4 w-4 shrink-0" />
                管理后台
              </button>
            </>
          ) : null}
          <button
            type="button"
            onClick={() => {
              onMyWorks();
              onCloseSidebar();
            }}
            className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm transition ${
              navMode === "my-works"
                ? "qr-nav-active"
                : "text-[var(--qr-text-secondary)] hover:bg-white/[0.06] hover:text-[var(--qr-text-primary)]"
            }`}
          >
            <FolderOpen className="h-4 w-4 shrink-0" />
            我的作品
          </button>
          {onGenerateHistory ? (
            <button
              type="button"
              onClick={() => {
                onGenerateHistory();
                onCloseSidebar();
              }}
              className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm transition ${
                navMode === "generate-history"
                  ? "qr-nav-active"
                  : "text-[var(--qr-text-secondary)] hover:bg-white/[0.06] hover:text-[var(--qr-text-primary)]"
              }`}
            >
              <History className="h-4 w-4 shrink-0" />
              生成记录
            </button>
          ) : null}
        </div>
      </aside>

      {sidebarOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          aria-label="关闭菜单"
          onClick={onCloseSidebar}
        />
      ) : null}
    </>
  );
}
