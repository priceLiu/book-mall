"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Menu, Sparkles, Video, ImageIcon, Smile, Globe, Volume2 } from "lucide-react";

import { QrGeneratePreviewModal } from "@/components/quick-replica/qr-generate-preview-modal";
import { QrKindBrowsePanel } from "@/components/quick-replica/qr-kind-browse-panel";
import { QrSidebar, type QrNavMode } from "@/components/quick-replica/qr-sidebar";
import { QrTemplateGallery } from "@/components/quick-replica/qr-template-gallery";
import { QrTemplatePreviewModal } from "@/components/quick-replica/qr-template-preview-modal";
import {
  QrWorkspacePanel,
  type QrGenerateJobResult,
} from "@/components/quick-replica/qr-workspace-panel";
import {
  QR_CATEGORIES,
  defaultWorkspaceDraft,
  getKindDef,
  type QrCategory,
  type QrKindBrowseItem,
  type QrTemplate,
  type QrWorkspaceDraft,
  templateToWorkspaceDraft,
} from "@/lib/qr-template-types";

type SessionInfo = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
};

type MiddleMode = "browse" | "workspace" | "welcome";

type Props = {
  session: SessionInfo | null;
  canManageFeatured?: boolean;
};

const CATEGORY_ICONS: Record<QrCategory, typeof Video> = {
  video: Video,
  image: ImageIcon,
  character: Smile,
  world: Globe,
  audio: Volume2,
};

export function QrAppClient({ session, canManageFeatured = false }: Props) {
  const [navMode, setNavMode] = useState<QrNavMode>("home");
  const [middleMode, setMiddleMode] = useState<MiddleMode>("welcome");
  const [category, setCategory] = useState<QrCategory>("video");
  const [selectedKind, setSelectedKind] = useState<string | null>(null);
  const [pinnedToolKey, setPinnedToolKey] = useState<string | null>(null);
  const [templates, setTemplates] = useState<QrTemplate[]>([]);
  const [kindItems, setKindItems] = useState<QrKindBrowseItem[]>([]);
  const [previewTemplate, setPreviewTemplate] = useState<QrTemplate | null>(null);
  const [generateResult, setGenerateResult] = useState<QrGenerateJobResult | null>(null);
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [kindsLoading, setKindsLoading] = useState(false);
  const kindsCacheRef = useRef<Map<QrCategory, QrKindBrowseItem[]>>(new Map());
  const [draft, setDraft] = useState<QrWorkspaceDraft>(
    defaultWorkspaceDraft({ category: "video", kind: "text-to-video" }),
  );

  const templateScope = navMode === "my-works" ? "my" : "all";

  const loadTemplates = useCallback(async () => {
    if (navMode === "home") {
      setTemplates([]);
      return;
    }
    setTemplatesLoading(true);
    const qs = new URLSearchParams({ scope: templateScope });
    if (navMode !== "my-works" && category) qs.set("category", category);
    if (selectedKind) qs.set("kind", selectedKind);
    if (pinnedToolKey && navMode === "pinned-tool") qs.set("toolKey", pinnedToolKey);
    try {
      const res = await fetch(
        `/api/book-mall/api/platform/v1/quick-replica/templates?${qs}`,
      );
      if (res.ok) {
        const data = (await res.json()) as { templates: QrTemplate[] };
        setTemplates(data.templates ?? []);
      }
    } finally {
      setTemplatesLoading(false);
    }
  }, [navMode, category, selectedKind, pinnedToolKey, templateScope]);

  const loadKinds = useCallback(async () => {
    if (navMode === "my-works" || navMode === "home" || navMode === "pinned-tool") {
      setKindItems([]);
      return;
    }

    const cached = kindsCacheRef.current.get(category);
    if (cached) {
      setKindItems(cached);
    }

    setKindsLoading(!cached);
    try {
      const res = await fetch(
        `/api/book-mall/api/platform/v1/quick-replica/kinds?category=${encodeURIComponent(category)}`,
      );
      if (res.ok) {
        const data = (await res.json()) as { kinds: QrKindBrowseItem[] };
        const kinds = data.kinds ?? [];
        kindsCacheRef.current.set(category, kinds);
        setKindItems(kinds);
      }
    } finally {
      setKindsLoading(false);
    }
  }, [navMode, category]);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    void loadKinds();
  }, [loadKinds]);

  useEffect(() => {
    if (navMode !== "category") return;
    for (const cat of QR_CATEGORIES) {
      if (cat.id === category || kindsCacheRef.current.has(cat.id)) continue;
      void fetch(
        `/api/book-mall/api/platform/v1/quick-replica/kinds?category=${encodeURIComponent(cat.id)}`,
      )
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { kinds?: QrKindBrowseItem[] } | null) => {
          if (data?.kinds) kindsCacheRef.current.set(cat.id, data.kinds);
        })
        .catch(() => undefined);
    }
  }, [navMode, category]);

  const galleryTitleSuffix = useMemo(() => {
    if (navMode === "my-works") return "我的作品";
    if (selectedKind) return getKindDef(selectedKind)?.label ?? selectedKind;
    if (pinnedToolKey) return QR_PINNED_LABEL(pinnedToolKey);
    return undefined;
  }, [navMode, selectedKind, pinnedToolKey]);

  const onHome = () => {
    setNavMode("home");
    setMiddleMode("welcome");
    setSelectedKind(null);
    setPinnedToolKey(null);
    setTemplates([]);
  };

  const onCategory = (cat: QrCategory) => {
    setNavMode("category");
    setCategory(cat);
    setMiddleMode("browse");
    setSelectedKind(null);
    setPinnedToolKey(null);
  };

  const onMyWorks = () => {
    setNavMode("my-works");
    setMiddleMode("browse");
    setSelectedKind(null);
    setPinnedToolKey(null);
  };

  const onPinnedTool = (toolKey: string, cat: QrCategory, kind: string) => {
    setNavMode("pinned-tool");
    setCategory(cat);
    setPinnedToolKey(toolKey);
    setSelectedKind(kind);
    setMiddleMode("workspace");
    setDraft(defaultWorkspaceDraft({ category: cat, kind, toolKey }));
  };

  const onSelectKind = (kind: string) => {
    setSelectedKind(kind);
    const def = getKindDef(kind);
    if (def?.toolKey) setPinnedToolKey(def.toolKey);
  };

  const onCopyTemplate = (t: QrTemplate) => {
    setDraft(templateToWorkspaceDraft(t));
    setMiddleMode("workspace");
    if (t.category) setCategory(t.category);
    setSelectedKind(t.kind);
  };

  const onGenerateComplete = (result: QrGenerateJobResult) => {
    setGenerateResult(result);
    setGenerateModalOpen(true);
  };

  const onGenerateSaved = () => {
    if (generateResult?.template) {
      setTemplates((prev) => [
        generateResult.template!,
        ...prev.filter((x) => x.id !== generateResult.template!.id),
      ]);
    }
    kindsCacheRef.current.delete(category);
    void loadTemplates();
    void loadKinds();
  };

  const middlePanel = (() => {
    if (middleMode === "welcome") {
      return (
        <div className="flex h-full flex-col items-center justify-center p-6 text-center">
          <Sparkles className="mb-3 h-8 w-8" style={{ color: "var(--qr-brand)" }} />
          <p className="text-sm text-[var(--qr-text-secondary)]">
            选择左侧分类浏览模板，或点击置顶工具进入工作区
          </p>
        </div>
      );
    }
    if (middleMode === "workspace") {
      return (
        <QrWorkspacePanel
          draft={draft}
          onDraftChange={setDraft}
          onGenerateComplete={onGenerateComplete}
          onBackToBrowse={
            navMode === "category" || navMode === "my-works"
              ? () => setMiddleMode("browse")
              : undefined
          }
        />
      );
    }
    if (navMode === "my-works") {
      return (
        <div className="flex h-full flex-col">
          <div className="border-b border-white/10 px-4 py-2 text-sm font-medium">
            我的作品
          </div>
          <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
            <p className="text-sm text-zinc-400">
              右侧展示你产生的作品；点击卡片可预览并复制到工作区继续编辑
            </p>
            <button
              type="button"
              className="qr-btn-secondary mt-4"
              onClick={() => onCategory("video")}
            >
              去创作
            </button>
          </div>
        </div>
      );
    }
    return (
      <QrKindBrowsePanel
        category={category}
        items={kindItems}
        selectedKind={selectedKind}
        loading={kindsLoading}
        onSelectKind={onSelectKind}
      />
    );
  })();

  return (
    <div className="flex h-dvh flex-col" style={{ background: "var(--qr-bg-page)" }}>
      <header
        className="flex shrink-0 items-center justify-between px-4 py-3"
        style={{
          borderBottom: "1px solid var(--qr-border)",
          background: "var(--qr-bg-surface)",
        }}
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="rounded-lg border p-2 lg:hidden"
            style={{ borderColor: "var(--qr-border)" }}
            onClick={() => setSidebarOpen(true)}
            aria-label="打开菜单"
          >
            <Menu className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" style={{ color: "var(--qr-brand)" }} />
            <span className="font-semibold">QuickReplica</span>
            <span className="hidden text-xs qr-panel-muted sm:inline">快速复制</span>
          </div>
        </div>
        <div className="text-xs text-[var(--qr-text-secondary)]">
          {session?.name ?? session?.phone ?? session?.email ?? "已登录"}
          {canManageFeatured ? (
            <span
              className="ml-2 rounded px-1.5 py-0.5 text-[10px]"
              style={{ background: "rgba(59,130,246,0.25)", color: "#bfdbfe" }}
            >
              管理
            </span>
          ) : null}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <QrSidebar
          navMode={navMode}
          category={category}
          pinnedToolKey={pinnedToolKey}
          sidebarOpen={sidebarOpen}
          onCloseSidebar={() => setSidebarOpen(false)}
          onHome={onHome}
          onCategory={onCategory}
          onMyWorks={onMyWorks}
          onPinnedTool={onPinnedTool}
        />

        <main className="flex min-w-0 flex-1 flex-col lg:flex-row">
          <section
            className="flex min-h-[280px] min-w-0 flex-1 flex-col lg:min-w-[480px] lg:max-w-2xl lg:flex-[1.15] lg:border-b-0 lg:border-r"
            style={{ borderBottom: "1px solid var(--qr-border)", borderColor: "var(--qr-border)" }}
          >
            {middlePanel}
          </section>

          <section className="flex min-h-0 min-w-0 flex-1 flex-col lg:min-w-[400px]">
            {navMode === "home" ? (
              <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">
                选择分类后在此浏览模板
              </div>
            ) : (
              <QrTemplateGallery
                category={navMode === "my-works" ? null : category}
                titleSuffix={galleryTitleSuffix}
                templates={templates}
                loading={templatesLoading}
                onSelectTemplate={setPreviewTemplate}
              />
            )}
          </section>
        </main>
      </div>

      <nav
        className="flex shrink-0 justify-around px-2 py-2 lg:hidden"
        style={{
          borderTop: "1px solid var(--qr-border)",
          background: "var(--qr-bg-surface)",
        }}
      >
        {QR_CATEGORIES.map((c) => {
          const Icon = CATEGORY_ICONS[c.id];
          const active = navMode === "category" && category === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onCategory(c.id)}
              className={`flex flex-col items-center gap-1 rounded-full px-3 py-1 text-[10px] ${
                active
                  ? "qr-nav-category-active"
                  : "text-[var(--qr-text-muted)]"
              }`}
            >
              <Icon className="h-4 w-4" />
              {c.label}
            </button>
          );
        })}
      </nav>

      <QrTemplatePreviewModal
        template={previewTemplate}
        open={previewTemplate !== null}
        canManageFeatured={canManageFeatured}
        onClose={() => setPreviewTemplate(null)}
        onCopy={onCopyTemplate}
        onFeaturedUpdated={() => {
          kindsCacheRef.current.delete(category);
          void loadKinds();
        }}
      />

      <QrGeneratePreviewModal
        open={generateModalOpen}
        result={generateResult}
        onClose={() => {
          setGenerateModalOpen(false);
          setGenerateResult(null);
        }}
        onSaved={onGenerateSaved}
      />
    </div>
  );
}

function QR_PINNED_LABEL(toolKey: string): string | undefined {
  const labels: Record<string, string> = {
    "motion-sync": "运动同步",
    "lip-sync": "唇语同步",
    "edit-image": "编辑图像",
    "edit-video": "编辑视频",
  };
  return labels[toolKey];
}
