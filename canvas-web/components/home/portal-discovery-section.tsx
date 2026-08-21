"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Search } from "lucide-react";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import {
  CanvasListCover,
  CANVAS_LIST_GRID_CLASS,
} from "@/components/canvas/canvas-list-cover";
import { TemplatePreviewDialog } from "@/components/home/template-preview-dialog";
import { fetchCanvasViewerUser } from "@/lib/canvas-viewer-session";
import {
  duplicatePortalCaseProject,
  duplicatePortalFeaturedProject,
  forkCanvasTemplate,
  listCanvasTemplates,
  listPortalCaseProjects,
  listPortalFeaturedProjects,
  createCanvasProject,
  type CanvasTemplateRecord,
  type PortalCaseProjectSummary,
  type PortalFeaturedProjectSummary,
} from "@/lib/canvas-api";
import { canvasListCoverPropsFromProject } from "@/lib/canvas/canvas-list-cover-props";
import { cloneGraphForNewProject } from "@/lib/canvas/clone";
import { migrateGraphV1ToV2 } from "@/lib/canvas/migrate";
import type { CanvasGraph } from "@/lib/canvas/types";
import { canvasEditionFromTemplateCanvas } from "@/lib/canvas/project-edition";
import {
  didPortalListLoadFail,
  isPortalGuestAuthLoadError,
  portalLoadErrorMessage,
} from "@/lib/canvas/portal-load-errors";

type DiscoveryKind = "featured" | "template" | "case";

type DiscoveryItem = {
  id: string;
  kind: DiscoveryKind;
  name: string;
  description: string;
  thumbnailUrl: string;
  ownerLabel: string;
  ownerId?: string;
  updatedAt: string;
  template?: CanvasTemplateRecord;
  featuredProject?: PortalFeaturedProjectSummary;
  caseProject?: PortalCaseProjectSummary;
};

type PreviewState =
  | { kind: "template"; item: CanvasTemplateRecord }
  | { kind: "featured"; item: PortalFeaturedProjectSummary }
  | { kind: "case"; item: PortalCaseProjectSummary };

const TAB_ALL = "全部";
const TAB_FEATURED = "精选";
const TAB_TEMPLATE = "模板";
const TAB_CASE = "案例";

const TABS = [TAB_ALL, TAB_FEATURED, TAB_TEMPLATE, TAB_CASE] as const;

function ownerLabel(
  owner?: { name: string | null; email: string | null } | null,
): string {
  if (!owner) return "社区用户";
  const name = owner.name?.trim();
  if (name) return name;
  const email = owner.email?.trim();
  if (email) return email.split("@")[0] ?? email;
  return "用户";
}

function templateOwnerId(t: CanvasTemplateRecord): string | undefined {
  return t.owner?.id ?? t.ownerUserId ?? undefined;
}

function isOwnItem(item: DiscoveryItem, viewerUserId: string | null): boolean {
  if (!viewerUserId) return false;
  if (item.ownerId === viewerUserId) return true;
  if (item.template && templateOwnerId(item.template) === viewerUserId) return true;
  return false;
}

function discoveryListCoverProps(item: DiscoveryItem) {
  const project = item.featuredProject ?? item.caseProject;
  if (project) return canvasListCoverPropsFromProject(project);
  return { url: item.thumbnailUrl };
}

function templateItem(t: CanvasTemplateRecord): DiscoveryItem {
  return {
    id: `tpl-${t.id}`,
    kind: "template",
    name: t.name,
    description: t.description?.trim() ?? "",
    thumbnailUrl: t.thumbnailUrl ?? t.thumbnail ?? "",
    ownerLabel: ownerLabel(t.owner),
    ownerId: templateOwnerId(t),
    updatedAt: t.updatedAt,
    template: t,
  };
}

export function PortalDiscoverySection() {
  const base = useBookMallBaseUrl();
  const [featuredProjects, setFeaturedProjects] = useState<PortalFeaturedProjectSummary[]>([]);
  const [publicTemplates, setPublicTemplates] = useState<CanvasTemplateRecord[]>([]);
  const [cases, setCases] = useState<PortalCaseProjectSummary[]>([]);
  const [viewerUserId, setViewerUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<string>(TAB_ALL);
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [forkingId, setForkingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (!base?.trim()) return;
    void fetchCanvasViewerUser(base)
      .then((u) => setViewerUserId(u?.id ?? null))
      .catch(() => setViewerUserId(null));
  }, [base]);

  useEffect(() => {
    if (!base?.trim()) return;
    setLoading(true);
    setError(null);
    setLoadFailed(false);

    void (async () => {
      const [featRes, pubRes, caseRes] = await Promise.allSettled([
        listPortalFeaturedProjects(base),
        listCanvasTemplates(base, "public"),
        listPortalCaseProjects(base, "pro2"),
      ]);

      if (featRes.status === "fulfilled") {
        const list = Array.isArray(featRes.value) ? featRes.value : [];
        setFeaturedProjects(list.filter((p) => p.edition === "pro2"));
      } else {
        setFeaturedProjects([]);
        console.warn("[portal-discovery] portal featured failed", featRes.reason);
      }

      if (pubRes.status === "fulfilled") {
        const list = Array.isArray(pubRes.value) ? pubRes.value : [];
        setPublicTemplates(
          list.filter(
            (t) =>
              t.edition === "pro2" ||
              canvasEditionFromTemplateCanvas(t.canvas) === "pro2",
          ),
        );
      } else {
        setPublicTemplates([]);
        console.warn("[portal-discovery] public templates failed", pubRes.reason);
      }

      if (caseRes.status === "fulfilled") {
        const list = Array.isArray(caseRes.value) ? caseRes.value : [];
        setCases(list);
      } else {
        setCases([]);
        console.warn("[portal-discovery] portal cases failed", caseRes.reason);
      }

      const results = [featRes, pubRes, caseRes];
      const failures = results.filter((r) => r.status === "rejected");
      if (didPortalListLoadFail(results)) {
        setLoadFailed(true);
        const first = failures[0] as PromiseRejectedResult;
        const msg = portalLoadErrorMessage(first.reason, "发现内容加载失败，请稍后重试");
        if (!isPortalGuestAuthLoadError(msg)) {
          setError(msg);
        }
      }

      setLoading(false);
    })();
  }, [base]);

  const items = useMemo((): DiscoveryItem[] => {
    const projectIds = new Set<string>();

    const featuredItems: DiscoveryItem[] = featuredProjects.map((f) => {
      projectIds.add(f.id);
      return {
        id: `feat-${f.id}`,
        kind: "featured",
        name: f.name,
        description: (f.portalFeaturedBlurb || f.description?.trim()) ?? "",
        thumbnailUrl: f.thumbnailUrl,
        ownerLabel: ownerLabel(f.owner),
        ownerId: f.owner?.id,
        updatedAt: f.updatedAt,
        featuredProject: f,
      };
    });

    const caseItems: DiscoveryItem[] = cases
      .filter((c) => !projectIds.has(c.id))
      .map((c) => {
        projectIds.add(c.id);
        return {
          id: `case-${c.id}`,
          kind: "case",
          name: c.name,
          description: (c.portalCaseBlurb || c.description?.trim()) ?? "",
          thumbnailUrl: c.thumbnailUrl,
          ownerLabel: ownerLabel(c.owner),
          ownerId: c.owner?.id,
          updatedAt: c.updatedAt,
          caseProject: c,
        };
      });

    // 若项目同时是精选又是案例，精选优先；案例列表已过滤重复 id
    const templateItems = publicTemplates.map(templateItem);

    return [...featuredItems, ...templateItems, ...caseItems].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }, [featuredProjects, publicTemplates, cases]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (activeTab === TAB_FEATURED && item.kind !== "featured") return false;
      if (activeTab === TAB_TEMPLATE && item.kind !== "template") return false;
      if (activeTab === TAB_CASE && item.kind !== "case") return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.ownerLabel.toLowerCase().includes(q)
      );
    });
  }, [items, activeTab, search]);

  const onForkTemplate = useCallback(
    async (tpl: CanvasTemplateRecord) => {
      if (!base?.trim()) {
        setError("未配置主站地址");
        return;
      }
      setForkingId(tpl.id);
      setError(null);
      try {
        const forked = await forkCanvasTemplate(base, tpl.id);
        const graph = migrateGraphV1ToV2(forked.canvas as CanvasGraph);
        const created = await createCanvasProject(base, {
          name: `${tpl.name} 画布`,
          canvas: cloneGraphForNewProject(graph),
        });
        window.location.href = `/canvas/${created.id}`;
      } catch (e) {
        setError(e instanceof Error ? e.message : "复制失败");
        setForkingId(null);
      }
    },
    [base],
  );

  const onCopyFeatured = useCallback(
    async (item: PortalFeaturedProjectSummary) => {
      if (!base?.trim()) return;
      setForkingId(item.id);
      setError(null);
      try {
        const created = await duplicatePortalFeaturedProject(base, item.id);
        window.location.href = `/canvas/${created.id}`;
      } catch (e) {
        setError(e instanceof Error ? e.message : "复制失败");
        setForkingId(null);
      }
    },
    [base],
  );

  const onCopyCase = useCallback(
    async (item: PortalCaseProjectSummary) => {
      if (!base?.trim()) return;
      setForkingId(item.id);
      setError(null);
      try {
        const created = await duplicatePortalCaseProject(base, item.id);
        window.location.href = `/canvas/${created.id}`;
      } catch (e) {
        setError(e instanceof Error ? e.message : "复制失败");
        setForkingId(null);
      }
    },
    [base],
  );

  const openItem = useCallback(
    (item: DiscoveryItem) => {
      const own = isOwnItem(item, viewerUserId);

      if (item.kind === "featured" && item.featuredProject) {
        if (own) {
          window.location.href = `/canvas/${item.featuredProject.id}`;
          return;
        }
        setPreview({ kind: "featured", item: item.featuredProject });
        return;
      }

      if (item.kind === "case" && item.caseProject) {
        if (own) {
          window.location.href = `/canvas/${item.caseProject.id}`;
          return;
        }
        setPreview({ kind: "case", item: item.caseProject });
        return;
      }

      if (item.template) {
        if (own) {
          void onForkTemplate(item.template);
          return;
        }
        setPreview({ kind: "template", item: item.template });
      }
    },
    [viewerUserId, onForkTemplate],
  );

  const kindBadge = (kind: DiscoveryKind) => {
    switch (kind) {
      case "featured":
        return "精选";
      case "template":
        return "模板";
      case "case":
        return "案例";
    }
  };

  return (
    <section className="canvas-page border-t border-[var(--canvas-border)] pb-16 pt-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-semibold text-white">发现</h2>
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--canvas-muted)]" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="请输入搜索内容"
            className="w-full rounded-full border border-[var(--canvas-border)] bg-[var(--canvas-surface)] py-2 pl-9 pr-4 text-sm text-white placeholder:text-[var(--canvas-muted)] focus:border-[var(--canvas-accent)]/50 focus:outline-none"
          />
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={
              activeTab === tab
                ? "rounded-full bg-white/15 px-4 py-1.5 text-sm font-medium text-white"
                : "rounded-full px-4 py-1.5 text-sm text-[var(--canvas-muted)] transition hover:text-white"
            }
          >
            {tab}
          </button>
        ))}
      </div>

      {error ? <p className="mb-4 text-sm text-red-300/90">{error}</p> : null}

      {loading ? (
        <div className="flex items-center gap-2 py-12 text-sm text-[var(--canvas-muted)]">
          <Loader2 className="size-4 animate-spin" />
          加载发现内容…
        </div>
      ) : loadFailed ? (
        <p className="rounded-xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-white/40">
          暂时无法加载内容，请稍后刷新页面。
        </p>
      ) : filtered.length > 0 ? (
        <ul className={CANVAS_LIST_GRID_CLASS}>
          {filtered.map((item) => {
            const own = isOwnItem(item, viewerUserId);
            const busy =
              item.template && forkingId === item.template.id
                ? true
                : item.featuredProject && forkingId === item.featuredProject.id
                  ? true
                  : item.caseProject && forkingId === item.caseProject.id;

            const cardInner = (
              <>
                <CanvasListCover
                  name={item.name}
                  graph={item.template?.canvas as CanvasGraph | undefined}
                  {...discoveryListCoverProps(item)}
                />
                <div className="mt-3 flex items-center gap-2">
                  <span
                    className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] font-medium text-white/80"
                    aria-hidden
                  >
                    {item.ownerLabel.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="truncate text-xs text-[var(--canvas-muted)]">
                    {item.ownerLabel}
                  </span>
                  <span className="rounded-full bg-white/8 px-2 py-0.5 text-[10px] text-white/55">
                    {kindBadge(item.kind)}
                  </span>
                </div>
                <h3 className="mt-2 line-clamp-2 text-sm font-medium text-white">
                  {item.name}
                </h3>
                {busy ? (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--canvas-accent)]">
                    <Loader2 className="size-3 animate-spin" />
                    正在打开…
                  </p>
                ) : null}
              </>
            );

            const ownProject =
              own &&
              (item.kind === "featured" || item.kind === "case") &&
              (item.featuredProject || item.caseProject);

            return (
              <li
                key={item.id}
                className="group rounded-2xl border border-[var(--canvas-border)] bg-[var(--canvas-surface)] p-3 transition hover:border-[var(--canvas-accent)]/40"
              >
                {ownProject ? (
                  <Link
                    href={`/canvas/${item.featuredProject?.id ?? item.caseProject?.id}`}
                    className="block w-full text-left"
                  >
                    {cardInner}
                  </Link>
                ) : (
                  <button
                    type="button"
                    className="block w-full text-left"
                    onClick={() => openItem(item)}
                    disabled={busy}
                  >
                    {cardInner}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}

      {preview?.kind === "template" ? (
        <TemplatePreviewDialog
          name={preview.item.name}
          description={preview.item.description}
          thumbnailUrl={preview.item.thumbnailUrl ?? preview.item.thumbnail}
          graph={preview.item.canvas as CanvasGraph}
          onClose={() => setPreview(null)}
          onCopy={() => void onForkTemplate(preview.item)}
          copying={forkingId === preview.item.id}
        />
      ) : null}

      {preview?.kind === "featured" ? (
        <TemplatePreviewDialog
          name={preview.item.name}
          description={preview.item.portalFeaturedBlurb || preview.item.description}
          thumbnailUrl={preview.item.coverVideoUrl ?? preview.item.thumbnailUrl}
          mediaKind={preview.item.coverMediaKind}
          posterUrl={preview.item.coverPosterUrl}
          onClose={() => setPreview(null)}
          onCopy={() => void onCopyFeatured(preview.item)}
          copying={forkingId === preview.item.id}
        />
      ) : null}

      {preview?.kind === "case" ? (
        <TemplatePreviewDialog
          name={preview.item.name}
          description={preview.item.portalCaseBlurb || preview.item.description}
          thumbnailUrl={preview.item.coverVideoUrl ?? preview.item.thumbnailUrl}
          mediaKind={preview.item.coverMediaKind}
          posterUrl={preview.item.coverPosterUrl}
          onClose={() => setPreview(null)}
          onCopy={() => void onCopyCase(preview.item)}
          copying={forkingId === preview.item.id}
        />
      ) : null}
    </section>
  );
}
