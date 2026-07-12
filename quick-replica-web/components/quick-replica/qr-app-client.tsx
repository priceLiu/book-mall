"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchQrPlatform } from "@/lib/qr-platform-fetch";
import { Menu, Sparkles, Video, ImageIcon, Smile, Globe, Volume2, Home } from "lucide-react";

import {
  QrGeneratePreviewModal,
  type QrGenerateModalPhase,
} from "@/components/quick-replica/qr-generate-preview-modal";
import { QrGenerateHistoryPanel } from "@/components/quick-replica/qr-generate-history-panel";
import { QrAdminPanel } from "@/components/quick-replica/qr-admin-panel";
import { QrMyWorksPreviewPanel } from "@/components/quick-replica/qr-my-works-preview-panel";
import { QrHomeWorksPanel } from "@/components/quick-replica/qr-home-works-panel";
import { QrSidebar, type QrNavMode } from "@/components/quick-replica/qr-sidebar";
import { QrKindBrowsePanel } from "@/components/quick-replica/qr-kind-browse-panel";
import { QrTemplateGallery } from "@/components/quick-replica/qr-template-gallery";
import { QrAudioRightPanel, type QrAudioRightTab } from "@/components/quick-replica/qr-audio-right-panel";
import { QrWorldBrowsePanel } from "@/components/quick-replica/qr-world-browse-panel";
import { QrTemplatePreviewModal } from "@/components/quick-replica/qr-template-preview-modal";
import { QrToast } from "@/components/quick-replica/qr-toast";
import {
  QrWorkspacePanel,
  type QrGenerateJobResult,
} from "@/components/quick-replica/qr-workspace-panel";
import {
  QR_CATEGORIES,
  QR_KIND_GALLERY_PREFETCH,
  defaultWorkspaceDraft,
  getKindDef,
  invalidateQrTemplateCacheForCategory,
  qrTemplateCacheKey,
  type QrCategory,
  type QrKindBrowseItem,
  type QrTemplate,
  type QrWorkspaceDraft,
  templateToWorkspaceDraft,
} from "@/lib/qr-template-types";
import { runQrGenerateJob, deleteQrUserTemplate } from "@/lib/run-qr-generate-job";
import { PortalNav } from "@/components/portal-nav";
import { getBookAccountUrl } from "@/lib/site-origin";
import {
  QR_HOME_FEED_CACHE_KEY,
  buildHomeFeedTemplates,
} from "@/lib/qr-home-feed";

type SessionInfo = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
};

type MiddleMode = "browse" | "workspace" | "welcome";

type Props = {
  session: SessionInfo | null;
  canManageFeatured?: boolean;
  bookMallAdminUrl?: string | null;
};

const CATEGORY_ICONS: Record<QrCategory, typeof Video> = {
  video: Video,
  image: ImageIcon,
  character: Smile,
  world: Globe,
  audio: Volume2,
};

export function QrAppClient({
  session,
  canManageFeatured = false,
  bookMallAdminUrl = null,
}: Props) {
  const [navMode, setNavMode] = useState<QrNavMode>("home");
  const [middleMode, setMiddleMode] = useState<MiddleMode>("welcome");
  const [category, setCategory] = useState<QrCategory>("video");
  const [selectedKind, setSelectedKind] = useState<string | null>(null);
  const [pinnedToolKey, setPinnedToolKey] = useState<string | null>(null);
  const [templates, setTemplates] = useState<QrTemplate[]>([]);
  const [kindItems, setKindItems] = useState<QrKindBrowseItem[]>([]);
  const [previewTemplate, setPreviewTemplate] = useState<QrTemplate | null>(null);
  const [copyToast, setCopyToast] = useState<string | null>(null);
  const [generateResult, setGenerateResult] = useState<QrGenerateJobResult | null>(null);
  const [generatePhase, setGeneratePhase] = useState<QrGenerateModalPhase>("generating");
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [generateLogId, setGenerateLogId] = useState<string | null>(null);
  const [generatePreviewImage, setGeneratePreviewImage] = useState<string | undefined>();
  const [generateDraftSnapshot, setGenerateDraftSnapshot] = useState<QrWorkspaceDraft | null>(
    null,
  );
  const [generating, setGenerating] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [kindsLoading, setKindsLoading] = useState(false);
  const kindsCacheRef = useRef<Map<QrCategory, QrKindBrowseItem[]>>(new Map());
  const templatesCacheRef = useRef<Map<string, QrTemplate[]>>(new Map());
  const [draft, setDraft] = useState<QrWorkspaceDraft>(
    defaultWorkspaceDraft({ category: "video", kind: "text-to-video" }),
  );
  const [audioRightTab, setAudioRightTab] = useState<QrAudioRightTab>("templates");
  const [worldOmniboxExpanded, setWorldOmniboxExpanded] = useState(false);
  const [voiceGalleryFocus, setVoiceGalleryFocus] = useState(false);
  const [myWorksCategory, setMyWorksCategory] = useState<QrCategory>("audio");
  const [myWorksPreview, setMyWorksPreview] = useState<QrTemplate | null>(null);
  const audioRightPanelRef = useRef<HTMLElement>(null);
  const voiceGalleryFocusTimerRef = useRef<number | null>(null);

  const templateScope =
    navMode === "my-works" || navMode === "generate-history" ? "my" : "all";

  const isWorldBrowse =
    navMode === "category" && category === "world" && middleMode === "browse";

  const bookAccountUrl = getBookAccountUrl();

  const browseKey = useMemo(() => {
    if (navMode === "home") return "";
    const parts = [templateScope];
    if (navMode === "my-works") {
      parts.push(myWorksCategory);
    } else if (category) {
      parts.push(category);
    }
    if (selectedKind) parts.push(selectedKind);
    if (pinnedToolKey && navMode === "pinned-tool") parts.push(pinnedToolKey);
    return parts.join("|");
  }, [navMode, category, selectedKind, pinnedToolKey, templateScope, myWorksCategory]);

  const browseKeyRef = useRef(browseKey);
  browseKeyRef.current = browseKey;

  const navModeRef = useRef(navMode);
  navModeRef.current = navMode;

  const loadHomeFeed = useCallback(async (force = false) => {
    if (!force) {
      const cached = templatesCacheRef.current.get(QR_HOME_FEED_CACHE_KEY);
      if (cached) {
        setTemplates(cached);
        setTemplatesLoading(false);
        return;
      }
    } else {
      templatesCacheRef.current.delete(QR_HOME_FEED_CACHE_KEY);
    }

    setTemplatesLoading(true);
    const requestNav = "home";
    try {
      const categories = QR_CATEGORIES.map((c) => c.id);
      const results = await Promise.all(
        categories.map(async (cat) => {
          const res = await fetchQrPlatform(
            `/api/book-mall/api/platform/v1/quick-replica/templates?scope=all&category=${encodeURIComponent(cat)}`,
          );
          if (!res.ok) return [] as QrTemplate[];
          const data = (await res.json()) as { templates?: QrTemplate[] };
          return data.templates ?? [];
        }),
      );
      if (navModeRef.current !== requestNav) return;
      const feed = buildHomeFeedTemplates(results.flat());
      templatesCacheRef.current.set(QR_HOME_FEED_CACHE_KEY, feed);
      setTemplates(feed);
    } finally {
      if (navModeRef.current === requestNav) {
        setTemplatesLoading(false);
      }
    }
  }, []);

  const loadTemplates = useCallback(async () => {
    if (navMode === "home") {
      await loadHomeFeed();
      return;
    }

    const requestKey = browseKeyRef.current;
    const cached = templatesCacheRef.current.get(requestKey);
    if (cached) {
      setTemplates(cached);
    } else {
      setTemplates([]);
    }
    setTemplatesLoading(true);

    const qs = new URLSearchParams({ scope: templateScope });
    if (navMode === "my-works") {
      qs.set("category", myWorksCategory);
    } else if (category) {
      qs.set("category", category);
    }
    if (selectedKind) qs.set("kind", selectedKind);
    if (pinnedToolKey && navMode === "pinned-tool") qs.set("toolKey", pinnedToolKey);
    try {
      const res = await fetchQrPlatform(
        `/api/book-mall/api/platform/v1/quick-replica/templates?${qs}`,
      );
      if (browseKeyRef.current !== requestKey) return;
      if (res.ok) {
        const data = (await res.json()) as { templates: QrTemplate[] };
        const list = data.templates ?? [];
        templatesCacheRef.current.set(requestKey, list);
        setTemplates(list);
      } else {
        setTemplates([]);
      }
    } finally {
      if (browseKeyRef.current === requestKey) {
        setTemplatesLoading(false);
      }
    }
  }, [navMode, category, selectedKind, pinnedToolKey, templateScope, myWorksCategory, loadHomeFeed]);

  const loadKinds = useCallback(async () => {
    if (navMode === "my-works" || navMode === "home" || navMode === "pinned-tool" || navMode === "generate-history") {
      setKindItems([]);
      setKindsLoading(false);
      return;
    }

    const requestCategory = category;
    const cached = kindsCacheRef.current.get(requestCategory);
    if (cached) {
      setKindItems(cached);
    } else {
      setKindItems([]);
    }
    setKindsLoading(true);
    try {
      const res = await fetchQrPlatform(
        `/api/book-mall/api/platform/v1/quick-replica/kinds?category=${encodeURIComponent(requestCategory)}`,
      );
      if (res.ok && category === requestCategory) {
        const data = (await res.json()) as { kinds: QrKindBrowseItem[] };
        const kinds = data.kinds ?? [];
        kindsCacheRef.current.set(requestCategory, kinds);
        setKindItems(kinds);
      }
    } finally {
      if (category === requestCategory) {
        setKindsLoading(false);
      }
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
      if (kindsCacheRef.current.has(cat.id)) continue;
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

  const prefetchTemplateList = useCallback(
    (cacheKey: string, params: { category: QrCategory; kind?: string }) => {
      if (templatesCacheRef.current.has(cacheKey)) return;
      const qs = new URLSearchParams({ scope: "all", category: params.category });
      if (params.kind) qs.set("kind", params.kind);
      void fetch(
        `/api/book-mall/api/platform/v1/quick-replica/templates?${qs}`,
      )
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { templates?: QrTemplate[] } | null) => {
          if (data?.templates) templatesCacheRef.current.set(cacheKey, data.templates);
        })
        .catch(() => undefined);
    },
    [],
  );

  useEffect(() => {
    if (navMode !== "category" && navMode !== "my-works" && navMode !== "admin") return;
    for (const cat of QR_CATEGORIES) {
      prefetchTemplateList(qrTemplateCacheKey("all", cat.id), { category: cat.id });
    }
    for (const { category: cat, kind } of QR_KIND_GALLERY_PREFETCH) {
      prefetchTemplateList(qrTemplateCacheKey("all", cat, kind), {
        category: cat,
        kind,
      });
    }
  }, [navMode, prefetchTemplateList]);

  useEffect(() => {
    if (navMode !== "category" || category !== "video") return;
    for (const { category: cat, kind } of QR_KIND_GALLERY_PREFETCH) {
      if (cat !== "video") continue;
      prefetchTemplateList(qrTemplateCacheKey("all", cat, kind), {
        category: cat,
        kind,
      });
    }
  }, [navMode, category, prefetchTemplateList]);

  const galleryTitleSuffix = useMemo(() => {
    if (navMode === "admin") {
      if (selectedKind === "motion-sync") return "运动同步";
      return "推荐模板";
    }
    if (navMode === "my-works") return "我的作品";
    if (navMode === "generate-history") return "我的作品";
    if (selectedKind) return getKindDef(selectedKind)?.label ?? selectedKind;
    if (pinnedToolKey) return QR_PINNED_LABEL(pinnedToolKey);
    return undefined;
  }, [navMode, selectedKind, pinnedToolKey]);

  const onHome = () => {
    setNavMode("home");
    setMiddleMode("welcome");
    setSelectedKind(null);
    setPinnedToolKey(null);
    setWorldOmniboxExpanded(false);
    const cached = templatesCacheRef.current.get(QR_HOME_FEED_CACHE_KEY);
    setTemplates(cached ?? []);
    setTemplatesLoading(!cached);
  };

  const openCategoryWithKind = useCallback(
    (cat: QrCategory, kind: string, toolKey?: string | null) => {
      setNavMode("category");
      setCategory(cat);
      setPinnedToolKey(toolKey ?? getKindDef(kind)?.toolKey ?? null);
      setSelectedKind(kind);

      if (cat === "audio") {
        setMiddleMode("workspace");
        setDraft(defaultWorkspaceDraft({ category: cat, kind, toolKey: toolKey ?? undefined }));
      } else if (cat === "world") {
        setMiddleMode("browse");
        setWorldOmniboxExpanded(false);
        setDraft(defaultWorkspaceDraft({ category: cat, kind }));
      } else {
        setMiddleMode("browse");
      }

      const cachedKinds = kindsCacheRef.current.get(cat);
      setKindItems(cachedKinds ?? []);
      setKindsLoading(!cachedKinds);

      const cacheKey = qrTemplateCacheKey("all", cat, kind);
      let cachedTemplates = templatesCacheRef.current.get(cacheKey);
      if (!cachedTemplates && cat === "video" && kind === "text-to-video") {
        cachedTemplates = templatesCacheRef.current.get(qrTemplateCacheKey("all", cat));
      }
      if (!cachedTemplates && cat === "image" && kind === "create-image") {
        cachedTemplates = templatesCacheRef.current.get(qrTemplateCacheKey("all", cat));
      }
      if (!cachedTemplates && cat === "character" && kind === "create-character") {
        cachedTemplates = templatesCacheRef.current.get(qrTemplateCacheKey("all", cat));
      }
      if (!cachedTemplates && cat === "audio" && kind === "create-voiceover") {
        cachedTemplates = templatesCacheRef.current.get(qrTemplateCacheKey("all", cat));
      }
      setTemplates(cachedTemplates ?? []);
      setTemplatesLoading(true);
    },
    [],
  );

  const onSelectHomeWork = useCallback(
    (t: QrTemplate) => {
      openCategoryWithKind(t.category, t.kind, t.toolKey ?? getKindDef(t.kind)?.toolKey ?? null);
    },
    [openCategoryWithKind],
  );

  const refreshHomeFeed = useCallback(() => {
    if (navModeRef.current !== "home") return;
    void loadHomeFeed(true);
  }, [loadHomeFeed]);

  const onCategory = (cat: QrCategory) => {
    setNavMode("category");
    setCategory(cat);
    setPinnedToolKey(null);
    if (cat === "audio") {
      setSelectedKind("create-voiceover");
      setMiddleMode("workspace");
      setDraft(defaultWorkspaceDraft({ category: "audio", kind: "create-voiceover" }));
    } else if (cat === "world") {
      setMiddleMode("browse");
      setSelectedKind(null);
      setWorldOmniboxExpanded(false);
      setDraft(defaultWorkspaceDraft({ category: "world", kind: "create-world" }));
    } else {
      setMiddleMode("browse");
      setSelectedKind(null);
    }
    const cachedKinds = kindsCacheRef.current.get(cat);
    setKindItems(cachedKinds ?? []);
    setKindsLoading(true);
    const cachedTemplates = templatesCacheRef.current.get(
      qrTemplateCacheKey("all", cat),
    );
    setTemplates(cachedTemplates ?? []);
    setTemplatesLoading(true);
  };

  const onMyWorks = () => {
    setNavMode("my-works");
    setMiddleMode("browse");
    setSelectedKind(null);
    setPinnedToolKey(null);
    setMyWorksCategory("audio");
    setMyWorksPreview(null);
  };

  const onGenerateHistory = () => {
    setNavMode("generate-history");
    setMiddleMode("browse");
    setSelectedKind(null);
    setPinnedToolKey(null);
  };

  const onAdmin = () => {
    setNavMode("admin");
    setMiddleMode("browse");
    setSelectedKind(null);
    setPinnedToolKey(null);
    setCategory("video");
    const cacheKey = qrTemplateCacheKey("all", "video");
    setTemplates(templatesCacheRef.current.get(cacheKey) ?? []);
    setTemplatesLoading(true);
  };

  const refreshTemplateCaches = useCallback(() => {
    templatesCacheRef.current.clear();
    kindsCacheRef.current.clear();
    void loadTemplates();
    void loadKinds();
  }, [loadKinds, loadTemplates]);

  const handleAdminScopeChange = useCallback(
    (scope: { category: QrCategory; kind: string | null }) => {
      setCategory(scope.category);
      setSelectedKind(scope.kind);
      const cacheKey = qrTemplateCacheKey(
        "all",
        scope.category,
        scope.kind ?? undefined,
      );
      setTemplates(templatesCacheRef.current.get(cacheKey) ?? []);
      setTemplatesLoading(true);
    },
    [],
  );

  const onPinnedTool = (toolKey: string, cat: QrCategory, kind: string) => {
    setNavMode("pinned-tool");
    setCategory(cat);
    setPinnedToolKey(toolKey);
    setSelectedKind(kind);
    setMiddleMode("workspace");
    setDraft(defaultWorkspaceDraft({ category: cat, kind, toolKey }));
  };

  const onSelectKind = (kind: string) => {
    if (selectedKind === kind) {
      setSelectedKind(null);
      setPinnedToolKey(null);
      const cacheKey = qrTemplateCacheKey("all", category);
      const cachedTemplates = templatesCacheRef.current.get(cacheKey);
      setTemplates(cachedTemplates ?? []);
      setTemplatesLoading(true);
      return;
    }

    setSelectedKind(kind);
    const def = getKindDef(kind);
    setPinnedToolKey(def?.toolKey ?? null);
    const cacheKey = qrTemplateCacheKey("all", category, kind);
    let cachedTemplates = templatesCacheRef.current.get(cacheKey);
    if (
      !cachedTemplates &&
      category === "video" &&
      kind === "text-to-video"
    ) {
      cachedTemplates = templatesCacheRef.current.get(qrTemplateCacheKey("all", category));
    }
    if (
      !cachedTemplates &&
      category === "image" &&
      kind === "create-image"
    ) {
      cachedTemplates = templatesCacheRef.current.get(qrTemplateCacheKey("all", category));
    }
    if (
      !cachedTemplates &&
      category === "character" &&
      kind === "create-character"
    ) {
      cachedTemplates = templatesCacheRef.current.get(qrTemplateCacheKey("all", category));
    }
    if (
      !cachedTemplates &&
      category === "audio" &&
      kind === "create-voiceover"
    ) {
      cachedTemplates = templatesCacheRef.current.get(qrTemplateCacheKey("all", category));
    }
    setTemplates(cachedTemplates ?? []);
    setTemplatesLoading(true);
  };

  const dismissCopyToast = useCallback(() => setCopyToast(null), []);

  const applyWorldTemplate = useCallback((t: QrTemplate) => {
    const nextDraft = templateToWorkspaceDraft(t);
    setDraft((prev) => ({
      ...nextDraft,
      savedTemplateId: t.source === "user" ? t.id : undefined,
    }));
    setWorldOmniboxExpanded(true);
    setCopyToast("已载入提示词");
  }, []);

  const onCopyTemplate = (t: QrTemplate) => {
    if (isWorldBrowse && t.category === "world") {
      applyWorldTemplate(t);
      setPreviewTemplate(null);
      return;
    }
    const nextDraft = templateToWorkspaceDraft(t);
    const isMotionSync = t.kind === "motion-sync" || t.toolKey === "motion-sync";
    setDraft((prev) => ({
      ...nextDraft,
      ...(isMotionSync
        ? {
            targetImageUrl: prev.targetImageUrl,
            sceneImageUrls: prev.sceneImageUrls,
          }
        : {}),
      savedTemplateId: t.source === "user" ? t.id : undefined,
    }));
    setMiddleMode("workspace");
    if (t.category) setCategory(t.category);
    setSelectedKind(t.kind);
    if (navMode === "home" || navMode === "admin") {
      setNavMode("category");
    }
    setCopyToast("已载入工作区，编辑后点「产生」生成");
  };

  const handleGenerate = useCallback(async (draftToRun: QrWorkspaceDraft) => {
    setGenerating(true);
    setGenerateModalOpen(true);
    setGeneratePhase("generating");
    setGenerateResult(null);
    setGenerateLogId(null);
    setGenerateDraftSnapshot(draftToRun);
    setGeneratePreviewImage(
      draftToRun.targetImageUrl.trim() ||
        draftToRun.sceneImageUrls.find((u) => u.trim()) ||
        undefined,
    );

    const job = await runQrGenerateJob(draftToRun);
    setGenerating(false);
    setGenerateLogId(job.logId ?? null);
    setGenerateResult(job);
    setGeneratePhase(
      job.status === "SUCCEEDED" && job.outputUrl ? "success" : "failed",
    );
  }, []);

  const onGenerateSaved = (template: QrTemplate) => {
    setTemplates((prev) => [template, ...prev.filter((x) => x.id !== template.id)]);
    kindsCacheRef.current.delete(category);
    invalidateQrTemplateCacheForCategory(templatesCacheRef.current, category);
    void loadTemplates();
    void loadKinds();
  };

  const handleDeleteTemplate = useCallback(
    async (template: QrTemplate) => {
      const result = await deleteQrUserTemplate(template.id);
      if ("error" in result) {
        setCopyToast(result.error);
        return;
      }
      setTemplates((prev) => prev.filter((t) => t.id !== template.id));
      templatesCacheRef.current.clear();
      invalidateQrTemplateCacheForCategory(templatesCacheRef.current, category);
      setPreviewTemplate(null);
      setMyWorksPreview((prev) => (prev?.id === template.id ? null : prev));
      setCopyToast("已删除");
      void loadTemplates();
    },
    [category, loadTemplates],
  );

  const handleOpenHistoryResult = useCallback(
    (args: {
      logId: string;
      phase: QrGenerateModalPhase;
      result: QrGenerateJobResult;
      previewImageUrl?: string;
    }) => {
      setGenerateLogId(args.logId);
      setGenerateResult(args.result);
      setGeneratePhase(args.phase);
      setGeneratePreviewImage(args.previewImageUrl);
      setGenerateModalOpen(true);
    },
    [],
  );

  const openVoiceGallery = useCallback(() => {
    setAudioRightTab("voices");
    setVoiceGalleryFocus(true);
    if (voiceGalleryFocusTimerRef.current != null) {
      window.clearTimeout(voiceGalleryFocusTimerRef.current);
    }
    voiceGalleryFocusTimerRef.current = window.setTimeout(() => {
      setVoiceGalleryFocus(false);
      voiceGalleryFocusTimerRef.current = null;
    }, 2800);
    window.requestAnimationFrame(() => {
      audioRightPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }, []);

  const handleVoiceSelectedFromGallery = useCallback(() => {
    setVoiceGalleryFocus(false);
    if (voiceGalleryFocusTimerRef.current != null) {
      window.clearTimeout(voiceGalleryFocusTimerRef.current);
      voiceGalleryFocusTimerRef.current = null;
    }
  }, []);

  const middlePanel = (() => {
    if (navMode === "admin") {
      return (
        <QrAdminPanel
          bookMallAdminUrl={bookMallAdminUrl}
          onTemplatesChanged={refreshTemplateCaches}
          onScopeChange={handleAdminScopeChange}
        />
      );
    }
    if (middleMode === "welcome") {
      return (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center p-6 text-center">
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
          generating={generating}
          onGenerate={(d) => void handleGenerate(d)}
          onBackToBrowse={
            navMode === "category" || navMode === "my-works"
              ? () => setMiddleMode("browse")
              : undefined
          }
          voicePickerActive={voiceGalleryFocus}
          onOpenVoiceGallery={openVoiceGallery}
        />
      );
    }
    if (navMode === "my-works") {
      return (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="shrink-0 border-b border-white/10 px-4 py-2">
            <p className="mb-2 text-sm font-medium">我的作品</p>
            <div className="flex flex-wrap gap-1.5">
              {QR_CATEGORIES.map((c) => {
                const Icon = CATEGORY_ICONS[c.id];
                const active = myWorksCategory === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setMyWorksCategory(c.id);
                      setMyWorksPreview(null);
                    }}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium transition ${
                      active
                        ? "bg-[rgba(59,130,246,0.22)] text-[var(--qr-text-primary)]"
                        : "bg-white/5 text-[var(--qr-text-muted)] hover:bg-white/10"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>
          <QrMyWorksPreviewPanel
            category={myWorksCategory}
            template={myWorksPreview}
            onSelectTemplate={setMyWorksPreview}
            onCopy={onCopyTemplate}
            onDelete={(t) => void handleDeleteTemplate(t)}
          />
        </div>
      );
    }
    if (navMode === "generate-history") {
      return <QrGenerateHistoryPanel onOpenResult={handleOpenHistoryResult} />;
    }
    return (
      <QrKindBrowsePanel
        key={category}
        category={category}
        items={kindItems}
        selectedKind={selectedKind}
        loading={kindsLoading}
        templatesLoading={templatesLoading}
        onSelectKind={onSelectKind}
      />
    );
  })();

  return (
    <div className="flex h-dvh flex-col overflow-hidden" style={{ background: "var(--qr-bg-page)" }}>
      <header
        className="flex shrink-0 items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3"
        style={{
          borderBottom: "1px solid var(--qr-border)",
          background: "var(--qr-bg-surface)",
        }}
      >
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
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
            <Sparkles className="h-5 w-5 shrink-0" style={{ color: "var(--qr-brand)" }} />
            <span className="font-semibold">QuickReplica</span>
            <span className="hidden text-xs qr-panel-muted sm:inline">快速复制</span>
          </div>
        </div>

        <div className="min-w-0 flex-1" aria-hidden />

        <div className="flex shrink-0 items-center gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] sm:gap-3 [&::-webkit-scrollbar]:hidden">
          <PortalNav current="quick-replica" />
          <span className="hidden h-4 w-px shrink-0 bg-white/15 sm:block" aria-hidden />
          {bookAccountUrl ? (
            <a
              href={bookAccountUrl}
              className="hidden rounded-full border border-[var(--qr-border)] px-2.5 py-1.5 text-xs transition hover:bg-white/5 sm:inline"
            >
              个人中心
            </a>
          ) : null}
          <span className="max-w-[100px] truncate text-xs text-[var(--qr-text-secondary)] md:max-w-[140px]">
            {session?.name ?? session?.phone ?? session?.email ?? "已登录"}
          </span>
          {canManageFeatured ? (
            <span
              className="rounded px-1.5 py-0.5 text-[10px]"
              style={{ background: "rgba(59,130,246,0.25)", color: "#bfdbfe" }}
            >
              管理
            </span>
          ) : null}
          <a
            href="/api/auth/logout"
            className="shrink-0 rounded-full border border-[var(--qr-border)] px-2.5 py-1.5 text-xs transition hover:bg-white/5"
          >
            退出
          </a>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <QrSidebar
          compact={isWorldBrowse}
          navMode={navMode}
          category={category}
          pinnedToolKey={pinnedToolKey}
          sidebarOpen={sidebarOpen}
          canManageFeatured={canManageFeatured}
          onCloseSidebar={() => setSidebarOpen(false)}
          onHome={onHome}
          onCategory={onCategory}
          onMyWorks={onMyWorks}
          onGenerateHistory={onGenerateHistory}
          onPinnedTool={onPinnedTool}
          onAdmin={canManageFeatured ? onAdmin : undefined}
        />

        {navMode === "home" ? (
          <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <QrHomeWorksPanel
              templates={templates}
              loading={templatesLoading}
              onSelectWork={onSelectHomeWork}
              onRefresh={refreshHomeFeed}
            />
          </main>
        ) : isWorldBrowse ? (
          <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <QrWorldBrowsePanel
              templates={templates}
              loading={templatesLoading}
              draft={draft}
              onDraftChange={setDraft}
              omniboxExpanded={worldOmniboxExpanded}
              onOmniboxExpandedChange={setWorldOmniboxExpanded}
              onApplyTemplate={applyWorldTemplate}
              onGenerate={(d) => void handleGenerate(d)}
              generating={generating}
              onToast={setCopyToast}
            />
          </main>
        ) : (
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:flex-row">
          <section
            className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:min-w-[480px] lg:max-w-2xl lg:flex-[1.15] lg:border-b-0 lg:border-r"
            style={{ borderBottom: "1px solid var(--qr-border)", borderColor: "var(--qr-border)" }}
          >
            {middlePanel}
          </section>

          <section
            ref={audioRightPanelRef}
            className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:min-w-[400px]"
          >
            {category === "audio" && navMode === "category" ? (
              <QrAudioRightPanel
                key={browseKey || category}
                category={category}
                titleSuffix={galleryTitleSuffix}
                templates={templates}
                templatesLoading={templatesLoading}
                draft={draft}
                onDraftChange={setDraft}
                onSelectTemplate={setPreviewTemplate}
                activeTab={audioRightTab}
                onTabChange={setAudioRightTab}
                voiceGalleryFocus={voiceGalleryFocus}
                onVoiceSelected={handleVoiceSelectedFromGallery}
              />
            ) : (
              <QrTemplateGallery
                key={browseKey || category}
                category={
                  navMode === "my-works"
                    ? myWorksCategory
                    : navMode === "generate-history"
                      ? null
                      : category
                }
                titleSuffix={navMode === "my-works" ? "我的作品" : galleryTitleSuffix}
                templates={templates}
                loading={templatesLoading}
                onSelectTemplate={(t) => {
                  if (navMode === "my-works") {
                    setMyWorksPreview(t);
                    return;
                  }
                  setPreviewTemplate(t);
                }}
                allowDownload={navMode === "my-works"}
              />
            )}
          </section>
        </main>
        )}
      </div>

      <nav
        className="flex shrink-0 justify-around px-2 py-2 lg:hidden"
        style={{
          borderTop: "1px solid var(--qr-border)",
          background: "var(--qr-bg-surface)",
        }}
      >
        <button
          type="button"
          onClick={onHome}
          className={`flex flex-col items-center gap-1 rounded-full px-3 py-1 text-[10px] ${
            navMode === "home" ? "qr-nav-category-active" : "text-[var(--qr-text-muted)]"
          }`}
        >
          <Home className="h-4 w-4" />
          首页
        </button>
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
        allowDelete={navMode === "my-works" || navMode === "generate-history"}
        onDelete={
          navMode === "my-works" || navMode === "generate-history"
            ? (t) => void handleDeleteTemplate(t)
            : undefined
        }
        onFeaturedUpdated={() => {
          kindsCacheRef.current.delete(category);
          invalidateQrTemplateCacheForCategory(templatesCacheRef.current, category);
          void loadKinds();
          void loadTemplates();
        }}
      />

      <QrGeneratePreviewModal
        open={generateModalOpen}
        phase={generatePhase}
        result={generateResult}
        logId={generateLogId}
        previewImageUrl={generatePreviewImage}
        generateDraft={generateDraftSnapshot}
        onClose={() => {
          if (generating) return;
          setGenerateModalOpen(false);
          setGenerateResult(null);
          setGenerateLogId(null);
          setGenerateDraftSnapshot(null);
        }}
        onSaved={onGenerateSaved}
      />

      <QrToast message={copyToast} onDismiss={dismissCopyToast} />
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
