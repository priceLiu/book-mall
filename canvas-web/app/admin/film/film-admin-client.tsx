"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Eye, Loader2, ShieldCheck, ShieldOff } from "lucide-react";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { CanvasListCover } from "@/components/canvas/canvas-list-cover";
import { canvasListCoverPropsFromProject } from "@/lib/canvas/canvas-list-cover-props";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { TemplatePreviewDialog } from "@/components/home/template-preview-dialog";
import { useCanvasAdmin } from "@/components/home/use-canvas-admin";
import {
  getAdminPortalProjectPreview,
  listAdminPortalFilmProjects,
  patchPortalCaseProject,
  type AdminPortalFilmProjectSummary,
  type AdminPortalProjectPreview,
} from "@/lib/canvas-api";
import type { CanvasGraph } from "@/lib/canvas/types";

type FilterTab = "all" | "published" | "draft";

function ownerLabel(
  owner?: { id: string; name: string | null; email: string | null } | null,
): string {
  if (!owner) return "—";
  return owner.name?.trim() || owner.email?.trim() || "用户";
}

export function FilmAdminClient() {
  const base = useBookMallBaseUrl();
  const isAdmin = useCanvasAdmin();
  const { doubleConfirm, alert } = useDialogs();

  const [tab, setTab] = useState<FilterTab>("all");
  const [projects, setProjects] = useState<AdminPortalFilmProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [preview, setPreview] = useState<AdminPortalProjectPreview | null>(null);
  const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!base?.trim()) return;
    setLoading(true);
    try {
      const list = await listAdminPortalFilmProjects(base);
      setProjects(Array.isArray(list) ? list : []);
    } catch (e) {
      setProjects([]);
      await alert({
        title: "加载失败",
        message: e instanceof Error ? e.message : "无法加载影视作品列表",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [alert, base]);

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin, load]);

  const filtered = useMemo(() => {
    if (tab === "published") {
      return projects.filter((p) => p.portalFilmCase);
    }
    if (tab === "draft") {
      return projects.filter((p) => !p.portalFilmCase);
    }
    return projects;
  }, [projects, tab]);

  const publishedCount = useMemo(
    () => projects.filter((p) => p.portalFilmCase).length,
    [projects],
  );

  const openPreview = async (projectId: string) => {
    if (!base?.trim()) return;
    setPreviewLoadingId(projectId);
    try {
      const data = await getAdminPortalProjectPreview(base, projectId);
      setPreview(data);
    } catch (e) {
      await alert({
        title: "预览失败",
        message: e instanceof Error ? e.message : "无法加载项目",
        variant: "error",
      });
    } finally {
      setPreviewLoadingId(null);
    }
  };

  const togglePublish = async (
    project: AdminPortalFilmProjectSummary,
    publish: boolean,
  ) => {
    if (!base?.trim()) return;

    if (!publish) {
      const ok = await doubleConfirm({
        first: {
          title: `下架「${project.name}」？`,
          message: "将从首页「视频作品」区移除，源画布不受影响。",
          confirmLabel: "继续",
          danger: true,
        },
        second: {
          title: "确认下架",
          message: "用户将无法在首页看到该影视作品。",
          confirmLabel: "下架",
          danger: true,
        },
      });
      if (!ok) return;
    }

    setActingId(project.id);
    try {
      await patchPortalCaseProject(base, project.id, { case: publish });
      await load();
    } catch (e) {
      await alert({
        title: publish ? "上架失败" : "下架失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    } finally {
      setActingId(null);
    }
  };

  if (!isAdmin) {
    return (
      <div className="canvas-page py-16 text-center text-sm text-[var(--canvas-muted)]">
        仅平台管理员可访问影视作品管理。
        <Link href="/" className="ml-2 text-[var(--canvas-accent)] hover:underline">
          返回首页
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden px-4 py-6 sm:px-6 md:px-8">
      <header className="mb-4 shrink-0">
        <h1 className="text-xl font-semibold text-white">影视作品</h1>
        <p className="mt-1 text-sm text-[var(--canvas-muted)]">
          管理首页「视频作品」区的上下架。仅分镜视频 1.0 项目会出现在此列表。
        </p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mb-6 flex flex-wrap gap-2">
          {(
            [
              ["all", `全部（${projects.length}）`],
              ["published", `已上架（${publishedCount}）`],
              ["draft", `已下架（${projects.length - publishedCount}）`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={
                tab === key
                  ? "rounded-full bg-white/15 px-4 py-1.5 text-sm text-white"
                  : "rounded-full px-4 py-1.5 text-sm text-[var(--canvas-muted)] hover:text-white"
              }
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-12 text-sm text-[var(--canvas-muted)]">
            <Loader2 className="size-4 animate-spin" />
            加载中…
          </div>
        ) : filtered.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/10 py-12 text-center text-sm text-white/40">
            {tab === "all" ? "暂无分镜 1.0 项目" : "当前筛选下无项目"}
          </p>
        ) : (
          <ul className="space-y-3">
            {filtered.map((project) => {
              const busy = actingId === project.id;
              const coverProps = canvasListCoverPropsFromProject(project);
              return (
                <li
                  key={project.id}
                  className="flex flex-wrap items-center gap-4 rounded-xl border border-white/10 bg-[var(--canvas-surface)] p-4"
                >
                  <div className="w-36 shrink-0 overflow-hidden rounded-lg">
                    <CanvasListCover
                      name={project.name}
                      {...coverProps}
                      showMediaKindBadge
                      className="!rounded-lg"
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-white">{project.name}</span>
                      <span
                        className={
                          project.portalFilmCase
                            ? "rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] text-emerald-200"
                            : "rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/50"
                        }
                      >
                        {project.portalFilmCase ? "已上架" : "已下架"}
                      </span>
                      <span className="rounded-full bg-cyan-400/10 px-2 py-0.5 text-[10px] text-cyan-300/90">
                        分镜 1.0
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[var(--canvas-muted)]">
                      {ownerLabel(project.owner)}
                      {project.mediaCount > 0
                        ? ` · ${project.mediaCount} 条媒体`
                        : " · 暂无入库媒体"}
                      {project.portalCaseBlurb ? ` · ${project.portalCaseBlurb}` : ""}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={busy || previewLoadingId === project.id}
                      className="inline-flex items-center gap-1 rounded-md border border-white/15 px-2 py-1 text-xs text-white/80"
                      onClick={() => void openPreview(project.id)}
                    >
                      {previewLoadingId === project.id ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <Eye className="size-3" />
                      )}
                      预览
                    </button>
                    {project.portalFilmCase ? (
                      <button
                        type="button"
                        disabled={busy}
                        className="inline-flex items-center gap-1 rounded-md border border-amber-400/40 px-2 py-1 text-xs text-amber-200"
                        onClick={() => void togglePublish(project, false)}
                      >
                        <ShieldOff className="size-3" />
                        下架
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        className="inline-flex items-center gap-1 rounded-md border border-emerald-400/40 px-2 py-1 text-xs text-emerald-200"
                        onClick={() => void togglePublish(project, true)}
                      >
                        <ShieldCheck className="size-3" />
                        上架
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {preview ? (
        <TemplatePreviewDialog
          name={preview.name}
          description={preview.portalCaseBlurb || preview.description}
          thumbnailUrl={preview.thumbnailUrl}
          graph={preview.canvas as CanvasGraph}
          onClose={() => setPreview(null)}
        />
      ) : null}
    </div>
  );
}
