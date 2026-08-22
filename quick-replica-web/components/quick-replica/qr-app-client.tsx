"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchQrPlatform } from "@/lib/qr-platform-fetch";
import { Menu, Sparkles, Video, ImageIcon, Smile, Globe, Volume2, Home } from "lucide-react";

import {
  QrGenerateDock,
  newQrGenerateSessionId,
  type QrGenerateSession,
} from "@/components/quick-replica/qr-generate-dock";
import {
  QrGeneratePreviewModal,
  type QrGenerateModalPhase,
} from "@/components/quick-replica/qr-generate-preview-modal";
import { QrGenerateHistoryPanel } from "@/components/quick-replica/qr-generate-history-panel";
import { QrMyWorksPreviewPanel } from "@/components/quick-replica/qr-my-works-preview-panel";
import { QrWorkflowShareDialog } from "@/components/quick-replica/qr-workflow-share-dialog";
import { QrHomeHeroPanel } from "@/components/quick-replica/qr-home-hero-panel";
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
import {
  deleteQrUserTemplate,
  runQrGenerateJob,
  watchQrGenerateJob,
} from "@/lib/run-qr-generate-job";
import { formatQrPlatformError } from "@/lib/qr-platform-fetch";
import { PortalNav } from "@/components/portal-nav";
import { getBookAccountUrl } from "@/lib/site-origin";
import {
  buildHomeCategoryCards,
  type QrHomeCategoryCard,
  QR_HOME_CARD_CATEGORIES,
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
  const [generateSessions, setGenerateSessions] = useState<QrGenerateSession[]>([]);
  const [focusedGenerateId, setFocusedGenerateId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [homeCategoryCards, setHomeCategoryCards] = useState<QrHomeCategoryCard[]>(() =>
    buildHomeCategoryCards({}),
  );
  const homeCardsCacheRef = useRef<QrHomeCategoryCard[] | null>(null);
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
  const [shareTemplate, setShareTemplate] = useState<QrTemplate | null>(null);
  const audioRightPanelRef = useRef<HTMLElement>(null);
  const voiceGalleryFocusTimerRef = useRef<number | null>(null);
  const focusedGenerate = generateSessions.find((s) => s.id === focusedGenerateId);
  const focusedGenerating =
    Boolean(focusedGenerate) &&
    !focusedGenerate?.minimized &&
    focusedGenerate?.phase === "generating";
  const dockSessions = generateSessions.filter((s) => s.minimized);
  const showGenerateModal = Boolean(focusedGenerate && !focusedGenerate.minimized);

  const templateScope =
    navMode === "my-works" || navMode === "generate-history" ? "my" : "all";

  const isWorldBrowse =
    navMode === "category" && category === "world" && middleMode === "browse";

  const bookAccountUrl = getBookAccountUrl();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const templateId = new URLSearchParams(window.location.search)
      .get("templateId")
      ?.trim();
    if (!templateId) return;

    void (async () => {
      try {
        const res = await fetchQrPlatform(
          `/api/book-mall/api/platform/v1/quick-replica/templates/${encodeURIComponent(templateId)}`,
        );
        if (!res.ok) return;
        const template = (await res.json()) as QrTemplate;
        setDraft(templateToWorkspaceDraft(template));
        setCategory(template.category);
        setSelectedKind(template.kind);
        setMiddleMode("workspace");
        setNavMode("category");
      } catch {
        /* ignore deep-link load errors */
      }
    })();
  }, []);

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
    if (!force && homeCardsCacheRef.current) {
      setHomeCategoryCards(homeCardsCacheRef.current);
      setTemplatesLoading(false);
      return;
    }
    if (force) {
      homeCardsCacheRef.current = null;
    }

    setTemplatesLoading(true);
    const requestNav = "home";
    try {
      const results = await Promise.all(
        QR_HOME_CARD_CATEGORIES.map(async (cat) => {
          const res = await fetchQrPlatform(
            `/api/book-mall/api/platform/v1/quick-replica/templates?scope=all&category=${encodeURIComponent(cat)}`,
          );
          if (!res.ok) return [] as QrTemplate[];
          const data = (await res.json()) as { templates?: QrTemplate[] };
          return data.templates ?? [];
        }),
      );
      if (navModeRef.current !== requestNav) return;
      const byCategory = Object.fromEntries(
        QR_HOME_CARD_CATEGORIES.map((cat, index) => [cat, results[index] ?? []]),
      ) as Partial<Record<QrCategory, QrTemplate[]>>;
      const cards = buildHomeCategoryCards(byCategory);
      homeCardsCacheRef.current = cards;
      setHomeCategoryCards(cards);
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
    if (navMode !== "category" && navMode !== "my-works") return;
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
    const cached = homeCardsCacheRef.current;
    setHomeCategoryCards(cached ?? buildHomeCategoryCards({}));
    setTemplatesLoading(!cached);
  };

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
    const refCount = nextDraft.sceneImageUrls.filter((u) => u.trim()).length;
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
    if (navMode === "home") {
      setNavMode("category");
    }
    setCopyToast(
      refCount > 0
        ? `已载入工作区（含 ${refCount} 张引用图），编辑后点「产生」生成`
        : "已载入工作区，编辑后点「产生」生成",
    );
  };

  const patchGenerateSession = useCallback(
    (id: string, patch: Partial<QrGenerateSession>) => {
      setGenerateSessions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, ...patch } : s)),
      );
    },
    [],
  );

  const handleGenerate = useCallback(async (draftToRun: QrWorkspaceDraft) => {
    const id = newQrGenerateSessionId();
    const previewImageUrl =
      draftToRun.targetImageUrl.trim() ||
      draftToRun.sceneImageUrls.find((u) => u.trim()) ||
      undefined;
    const session: QrGenerateSession = {
      id,
      logId: null,
      phase: "generating",
      result: null,
      draft: draftToRun,
      previewImageUrl,
      alreadySaved: false,
      minimized: false,
      startedAt: Date.now(),
    };
    setGenerateSessions((prev) => [
      ...prev.map((s) =>
        s.phase === "generating" && !s.minimized ? { ...s, minimized: true } : s,
      ),
      session,
    ]);
    setFocusedGenerateId(id);

    try {
      const job = await runQrGenerateJob(draftToRun);
      const phase: QrGenerateModalPhase =
        job.status === "SUCCEEDED" && job.outputUrl ? "success" : "failed";
      setGenerateSessions((prev) => {
        const othersBusy = prev.some(
          (s) => s.id !== id && !s.minimized && s.phase === "generating",
        );
        return prev.map((s) =>
          s.id === id
            ? {
                ...s,
                logId: job.logId ?? s.logId,
                result: job,
                phase,
                minimized: othersBusy ? s.minimized : false,
              }
            : s,
        );
      });
      setFocusedGenerateId((current) => {
        if (current && current !== id) return current;
        return id;
      });
      if (job.status === "FAILED" && job.error) {
        setCopyToast(formatQrPlatformError(job.error));
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "生成请求失败";
      patchGenerateSession(id, {
        result: { status: "FAILED", error: message },
        phase: "failed",
        minimized: false,
      });
      setFocusedGenerateId(id);
      setCopyToast(formatQrPlatformError(message));
    }
  }, [patchGenerateSession]);

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
      alreadySaved?: boolean;
      generateDraft?: QrWorkspaceDraft;
    }) => {
      let sessionId = "";
      setGenerateSessions((prev) => {
        const existing = prev.find((s) => s.logId === args.logId);
        sessionId = existing?.id ?? newQrGenerateSessionId();
        const next: QrGenerateSession = {
          id: sessionId,
          logId: args.logId,
          phase: args.phase,
          result: args.result,
          draft:
            args.generateDraft ??
            existing?.draft ??
            defaultWorkspaceDraft({ category: "video", kind: "text-to-video" }),
          previewImageUrl: args.previewImageUrl,
          alreadySaved: Boolean(args.alreadySaved),
          minimized: false,
          startedAt: existing?.startedAt ?? Date.now(),
        };
        return [...prev.filter((s) => s.id !== sessionId && s.logId !== args.logId), next];
      });
      setFocusedGenerateId(sessionId);
      if (args.phase !== "generating") return;
      void watchQrGenerateJob(args.logId).then((job) => {
        const phase: QrGenerateModalPhase =
          job.status === "SUCCEEDED" && job.outputUrl ? "success" : "failed";
        setGenerateSessions((prev) =>
          prev.map((s) =>
            s.logId === args.logId || s.id === sessionId
              ? { ...s, logId: job.logId ?? args.logId, result: job, phase, minimized: false }
              : s,
          ),
        );
        setFocusedGenerateId((current) => current ?? sessionId);
      });
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
          generating={focusedGenerating}
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
            onShare={(t) => setShareTemplate(t)}
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
        className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 sm:px-4 sm:py-3"
        style={{
          borderBottom: "1px solid var(--qr-border)",
          background:
            navMode === "home"
              ? "var(--qr-bg-page)"
              : "var(--qr-bg-surface)",
        }}
      >
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          {navMode !== "home" ? (
            <button
              type="button"
              className="rounded-lg border p-2 lg:hidden"
              style={{ borderColor: "var(--qr-border)" }}
              onClick={() => setSidebarOpen(true)}
              aria-label="打开菜单"
            >
              <Menu className="h-4 w-4" />
            </button>
          ) : null}
          <div className="flex min-w-0 items-center gap-2">
            <Sparkles className="h-5 w-5 shrink-0" style={{ color: "var(--qr-brand)" }} />
            <span className="truncate font-semibold">QuickReplica</span>
            <span className="hidden text-xs qr-panel-muted sm:inline">快速复刻</span>
          </div>
        </div>

        <div className="order-3 flex w-full min-w-0 justify-center overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] md:order-none md:w-auto md:flex-1 [&::-webkit-scrollbar]:hidden">
          <PortalNav current="quick-replica" />
        </div>

        <div className="ml-auto flex min-w-0 items-center gap-2 overflow-x-auto sm:gap-3">
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
        {navMode !== "home" ? (
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
            bookMallAdminUrl={bookMallAdminUrl}
          />
        ) : null}

        {navMode === "home" ? (
          <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <QrHomeHeroPanel
              cards={homeCategoryCards}
              loading={templatesLoading}
              onCategoryClick={onCategory}
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
              generating={focusedGenerating}
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

      {navMode !== "home" ? (
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
          className="flex flex-col items-center gap-1 rounded-full px-3 py-1 text-[10px] text-[var(--qr-text-muted)]"
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
      ) : null}

      <QrTemplatePreviewModal
        template={previewTemplate}
        open={previewTemplate !== null}
        onClose={() => setPreviewTemplate(null)}
        onCopy={onCopyTemplate}
        allowDelete={navMode === "my-works" || navMode === "generate-history"}
        onDelete={
          navMode === "my-works" || navMode === "generate-history"
            ? (t) => void handleDeleteTemplate(t)
            : undefined
        }
      />

      <QrGeneratePreviewModal
        open={showGenerateModal}
        phase={focusedGenerate?.phase ?? "generating"}
        result={focusedGenerate?.result ?? null}
        logId={focusedGenerate?.logId}
        previewImageUrl={focusedGenerate?.previewImageUrl}
        generateDraft={focusedGenerate?.draft ?? null}
        alreadySaved={focusedGenerate?.alreadySaved ?? false}
        onMinimize={() => {
          if (!focusedGenerateId) return;
          patchGenerateSession(focusedGenerateId, { minimized: true });
          setFocusedGenerateId(null);
        }}
        onClose={() => {
          if (!focusedGenerateId) return;
          const id = focusedGenerateId;
          setFocusedGenerateId(null);
          setGenerateSessions((prev) => prev.filter((s) => s.id !== id));
        }}
        onSaved={(template) => {
          if (focusedGenerateId) {
            patchGenerateSession(focusedGenerateId, { alreadySaved: true });
          }
          onGenerateSaved(template);
        }}
      />

      <QrGenerateDock
        sessions={dockSessions}
        onExpand={(id) => {
          patchGenerateSession(id, { minimized: false });
          setFocusedGenerateId(id);
        }}
        onDismiss={(id) => {
          setGenerateSessions((prev) => prev.filter((s) => s.id !== id));
          setFocusedGenerateId((current) => (current === id ? null : current));
        }}
      />

      <QrWorkflowShareDialog
        templateId={shareTemplate?.id ?? ""}
        templateTitle={shareTemplate?.title ?? "我的作品"}
        open={Boolean(shareTemplate)}
        onClose={() => setShareTemplate(null)}
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
