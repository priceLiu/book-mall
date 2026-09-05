"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, Eye, Loader2, ShieldOff, X } from "lucide-react";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { CanvasListCover } from "@/components/canvas/canvas-list-cover";
import { canvasListCoverPropsFromProject } from "@/lib/canvas/canvas-list-cover-props";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { TemplatePreviewDialog } from "@/components/home/template-preview-dialog";
import { useCanvasAdmin } from "@/components/home/use-canvas-admin";
import {
  deleteCanvasTemplate,
  getAdminPortalProjectPreview,
  listCanvasTemplates,
  listPortalCaseProjects,
  listPortalFeaturedProjects,
  listPortalSubmissions,
  patchCanvasTemplate,
  patchPortalCaseProject,
  patchPortalFeaturedProject,
  reviewPortalSubmission,
  type AdminPortalProjectPreview,
  type CanvasPortalPublishKind,
  type CanvasTemplateRecord,
  type PortalCaseProjectSummary,
  type PortalFeaturedProjectSummary,
  type PortalSubmissionRecord,
} from "@/lib/canvas-api";
import { canvasEditionFromTemplateCanvas } from "@/lib/canvas/project-edition";
import type { CanvasGraph } from "@/lib/canvas/types";

const KIND_LABELS: Record<CanvasPortalPublishKind, string> = {
  CASE: "案例",
  FEATURED: "精选",
  PUBLIC_TEMPLATE: "社区模板",
  TEMPLATE: "私有模板",
};

type PublishedRow =
  | {
      id: string;
      kind: "featured";
      name: string;
      description: string;
      thumbnailUrl: string;
      ownerLabel: string;
      project: PortalFeaturedProjectSummary;
    }
  | {
      id: string;
      kind: "case";
      name: string;
      description: string;
      thumbnailUrl: string;
      ownerLabel: string;
      project: PortalCaseProjectSummary;
    }
  | {
      id: string;
      kind: "template";
      name: string;
      description: string;
      thumbnailUrl: string;
      ownerLabel: string;
      template: CanvasTemplateRecord;
    };

type PreviewState =
  | { kind: "project"; data: AdminPortalProjectPreview }
  | { kind: "template"; data: CanvasTemplateRecord };

function ownerLabel(
  owner?: { name: string | null; email: string | null } | null,
): string {
  if (!owner) return "—";
  return owner.name?.trim() || owner.email?.trim() || "用户";
}

export function PortalAdminClient() {
  const base = useBookMallBaseUrl();
  const isAdmin = useCanvasAdmin();
  const { doubleConfirm, alert } = useDialogs();

  const [tab, setTab] = useState<"pending" | "published">("pending");
  const [pending, setPending] = useState<PortalSubmissionRecord[]>([]);
  const [featured, setFeatured] = useState<PortalFeaturedProjectSummary[]>([]);
  const [cases, setCases] = useState<PortalCaseProjectSummary[]>([]);
  const [templates, setTemplates] = useState<CanvasTemplateRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [approveKinds, setApproveKinds] = useState<
    Record<string, CanvasPortalPublishKind>
  >({});
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!base?.trim()) return;
    setLoading(true);
    try {
      const [pendRes, featRes, caseRes, tplRes] = await Promise.allSettled([
        listPortalSubmissions(base, "PENDING"),
        listPortalFeaturedProjects(base),
        listPortalCaseProjects(base),
        listCanvasTemplates(base, "public"),
      ]);
      if (pendRes.status === "fulfilled") {
        const list = Array.isArray(pendRes.value) ? pendRes.value : [];
        setPending(list);
        setApproveKinds((prev) => {
          const next = { ...prev };
          for (const row of list) {
            if (!next[row.id]) next[row.id] = row.requestKind;
          }
          return next;
        });
      } else setPending([]);
      setFeatured(
        featRes.status === "fulfilled" && Array.isArray(featRes.value)
          ? featRes.value.filter((p) => p.edition === "pro2")
          : [],
      );
      setCases(
        caseRes.status === "fulfilled" && Array.isArray(caseRes.value)
          ? caseRes.value.filter((c) => c.edition === "pro2")
          : [],
      );
      setTemplates(
        tplRes.status === "fulfilled" && Array.isArray(tplRes.value)
          ? tplRes.value.filter(
              (t) =>
                t.edition === "pro2" ||
                canvasEditionFromTemplateCanvas(t.canvas) === "pro2",
            )
          : [],
      );
    } finally {
      setLoading(false);
    }
  }, [base]);

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin, load]);

  const publishedRows = useMemo((): PublishedRow[] => {
    const feat: PublishedRow[] = featured.map((p) => ({
      id: `feat-${p.id}`,
      kind: "featured",
      name: p.name,
      description: p.portalFeaturedBlurb || p.description,
      thumbnailUrl: p.thumbnailUrl,
      ownerLabel: ownerLabel(p.owner),
      project: p,
    }));
    const caseRows: PublishedRow[] = cases.map((c) => ({
      id: `case-${c.id}`,
      kind: "case",
      name: c.name,
      description: c.portalCaseBlurb || c.description,
      thumbnailUrl: c.thumbnailUrl,
      ownerLabel: ownerLabel(c.owner),
      project: c,
    }));
    const tpl: PublishedRow[] = templates.map((t) => ({
      id: `tpl-${t.id}`,
      kind: "template",
      name: t.name,
      description: t.description ?? "",
      thumbnailUrl: t.thumbnailUrl ?? t.thumbnail ?? "",
      ownerLabel: ownerLabel(t.owner),
      template: t,
    }));
    return [...feat, ...caseRows, ...tpl];
  }, [featured, cases, templates]);

  const review = async (id: string, approve: boolean) => {
    if (!base?.trim()) return;
    setActingId(id);
    try {
      await reviewPortalSubmission(base, id, {
        approve,
        approvedKind: approve ? approveKinds[id] : undefined,
      });
      await load();
    } catch (e) {
      await alert({
        title: "操作失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    } finally {
      setActingId(null);
    }
  };

  const openProjectPreview = async (projectId: string) => {
    if (!base?.trim()) return;
    setPreviewLoadingId(projectId);
    try {
      const data = await getAdminPortalProjectPreview(base, projectId);
      setPreview({ kind: "project", data });
    } catch (e) {
      await alert({
        title: "预览失败",
        message: e instanceof Error ? e.message : "无法加载画布",
        variant: "error",
      });
    } finally {
      setPreviewLoadingId(null);
    }
  };

  const delistFeatured = async (id: string, name: string) => {
    if (!base?.trim()) return;
    const ok = await doubleConfirm({
      first: {
        title: `下架精选「${name}」？`,
        message: "将从首页发现区移除，源画布不受影响。",
        confirmLabel: "继续",
        danger: true,
      },
      second: {
        title: "确认下架",
        message: "用户将无法在首页看到该精选工作流。",
        confirmLabel: "下架",
        danger: true,
      },
    });
    if (!ok) return;
    setActingId(id);
    try {
      await patchPortalFeaturedProject(base, id, { featured: false });
      await load();
    } catch (e) {
      await alert({
        title: "下架失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    } finally {
      setActingId(null);
    }
  };

  const delistCase = async (id: string, name: string) => {
    if (!base?.trim()) return;
    const ok = await doubleConfirm({
      first: {
        title: `下架案例「${name}」？`,
        message: "将从首页案例区移除。",
        confirmLabel: "继续",
        danger: true,
      },
      second: {
        title: "确认下架",
        message: "用户将无法在首页看到该案例。",
        confirmLabel: "下架",
        danger: true,
      },
    });
    if (!ok) return;
    setActingId(id);
    try {
      await patchPortalCaseProject(base, id, { case: false });
      await load();
    } catch (e) {
      await alert({
        title: "下架失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    } finally {
      setActingId(null);
    }
  };

  const disableTemplate = async (tpl: CanvasTemplateRecord) => {
    if (!base?.trim()) return;
    const ok = await doubleConfirm({
      first: {
        title: `禁用模板「${tpl.name}」？`,
        message: "将改为私有，不再在首页社区模板展示。",
        confirmLabel: "继续",
        danger: true,
      },
      second: {
        title: "确认禁用",
        message: "他人将无法从发现区复制该模板。",
        confirmLabel: "禁用",
        danger: true,
      },
    });
    if (!ok) return;
    setActingId(tpl.id);
    try {
      await patchCanvasTemplate(base, tpl.id, { visibility: "private" });
      await load();
    } catch (e) {
      await alert({
        title: "禁用失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    } finally {
      setActingId(null);
    }
  };

  const removeTemplate = async (tpl: CanvasTemplateRecord) => {
    if (!base?.trim()) return;
    const ok = await doubleConfirm({
      first: {
        title: `删除模板「${tpl.name}」？`,
        message: "将从社区列表永久移除。",
        confirmLabel: "继续",
        danger: true,
      },
      second: {
        title: "不可恢复",
        message: "将删除模板记录；他人已复制的画布不受影响。",
        confirmLabel: "永久删除",
        danger: true,
      },
    });
    if (!ok) return;
    setActingId(tpl.id);
    try {
      await deleteCanvasTemplate(base, tpl.id);
      await load();
    } catch (e) {
      await alert({
        title: "删除失败",
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
        仅平台管理员可访问工作流管理。
        <Link href="/" className="ml-2 text-[var(--canvas-accent)] hover:underline">
          返回首页
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden px-4 py-6 sm:px-6 md:px-8">
      <header className="mb-4 shrink-0">
        <h1 className="text-xl font-semibold text-white">工作流管理</h1>
        <p className="mt-1 text-sm text-[var(--canvas-muted)]">
          审核用户投稿、管理首页精选 / 案例 / 社区模板的上下架与禁用。
        </p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mb-6 flex gap-2">
        <button
          type="button"
          onClick={() => setTab("pending")}
          className={
            tab === "pending"
              ? "rounded-full bg-white/15 px-4 py-1.5 text-sm text-white"
              : "rounded-full px-4 py-1.5 text-sm text-[var(--canvas-muted)] hover:text-white"
          }
        >
          待审核（{pending.length}）
        </button>
        <button
          type="button"
          onClick={() => setTab("published")}
          className={
            tab === "published"
              ? "rounded-full bg-white/15 px-4 py-1.5 text-sm text-white"
              : "rounded-full px-4 py-1.5 text-sm text-[var(--canvas-muted)] hover:text-white"
          }
        >
          已发布（{publishedRows.length}）
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-12 text-sm text-[var(--canvas-muted)]">
          <Loader2 className="size-4 animate-spin" />
          加载中…
        </div>
      ) : tab === "pending" ? (
        pending.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/10 py-12 text-center text-sm text-white/40">
            暂无待审核投稿
          </p>
        ) : (
          <ul className="space-y-3">
            {pending.map((row) => (
              <li
                key={row.id}
                className="rounded-xl border border-white/10 bg-[var(--canvas-surface)] p-4"
              >
                <div className="flex flex-wrap items-start gap-4">
                  <div className="w-32 shrink-0 overflow-hidden rounded-lg">
                    <CanvasListCover
                      name={row.project.name}
                      url={row.project.thumbnailUrl}
                      className="!rounded-lg"
                    />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-white">{row.project.name}</p>
                    <p className="mt-1 text-xs text-[var(--canvas-muted)]">
                      {row.user.name || row.user.email} · 申请{" "}
                      {KIND_LABELS[row.requestKind]} · {row.project.edition}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={previewLoadingId === row.projectId}
                      className="inline-flex items-center gap-1 rounded-md border border-white/15 px-2 py-1 text-xs text-white/80"
                      onClick={() => void openProjectPreview(row.projectId)}
                    >
                      {previewLoadingId === row.projectId ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <Eye className="size-3" />
                      )}
                      预览
                    </button>
                    <select
                      value={approveKinds[row.id] ?? row.requestKind}
                      onChange={(e) =>
                        setApproveKinds((prev) => ({
                          ...prev,
                          [row.id]: e.target.value as CanvasPortalPublishKind,
                        }))
                      }
                      className="rounded-md border border-white/15 bg-black/30 px-2 py-1 text-xs text-white"
                    >
                      {(Object.keys(KIND_LABELS) as CanvasPortalPublishKind[]).map(
                        (kind) => (
                          <option key={kind} value={kind}>
                            发布为 {KIND_LABELS[kind]}
                          </option>
                        ),
                      )}
                    </select>
                    <button
                      type="button"
                      disabled={actingId === row.id}
                      className="inline-flex items-center gap-1 rounded-md border border-emerald-400/40 px-2 py-1 text-xs text-emerald-200"
                      onClick={() => void review(row.id, true)}
                    >
                      <Check className="size-3" />
                      通过
                    </button>
                    <button
                      type="button"
                      disabled={actingId === row.id}
                      className="inline-flex items-center gap-1 rounded-md border border-red-400/40 px-2 py-1 text-xs text-red-200"
                      onClick={() => void review(row.id, false)}
                    >
                      <X className="size-3" />
                      驳回
                    </button>
                  </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )
      ) : publishedRows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/10 py-12 text-center text-sm text-white/40">
          暂无已发布工作流
        </p>
      ) : (
        <ul className="space-y-3">
          {publishedRows.map((row) => {
            const busy =
              row.kind === "template"
                ? actingId === row.template.id
                : actingId === row.project.id;
            return (
              <li
                key={row.id}
                className="rounded-xl border border-white/10 bg-[var(--canvas-surface)] p-4"
              >
                <div className="flex flex-wrap items-center gap-4">
                  <div className="w-32 shrink-0 overflow-hidden rounded-lg">
                    {row.kind === "template" ? (
                      <CanvasListCover
                        name={row.name}
                        url={row.thumbnailUrl}
                        graph={row.template.canvas as CanvasGraph}
                        className="!rounded-lg"
                      />
                    ) : (
                      <CanvasListCover
                        name={row.name}
                        {...canvasListCoverPropsFromProject(row.project)}
                        className="!rounded-lg"
                      />
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-white">{row.name}</span>
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/60">
                      {row.kind === "featured"
                        ? "精选"
                        : row.kind === "case"
                          ? "案例"
                          : "模板"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--canvas-muted)]">
                    {row.ownerLabel}
                    {row.description ? ` · ${row.description}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    className="inline-flex items-center gap-1 rounded-md border border-white/15 px-2 py-1 text-xs text-white/80"
                    onClick={() => {
                      if (row.kind === "template") {
                        setPreview({ kind: "template", data: row.template });
                      } else {
                        void openProjectPreview(row.project.id);
                      }
                    }}
                  >
                    <Eye className="size-3" />
                    预览
                  </button>
                  {row.kind === "featured" ? (
                    <button
                      type="button"
                      disabled={busy}
                      className="inline-flex items-center gap-1 rounded-md border border-amber-400/40 px-2 py-1 text-xs text-amber-200"
                      onClick={() =>
                        void delistFeatured(row.project.id, row.name)
                      }
                    >
                      <ShieldOff className="size-3" />
                      下架精选
                    </button>
                  ) : null}
                  {row.kind === "case" ? (
                    <button
                      type="button"
                      disabled={busy}
                      className="inline-flex items-center gap-1 rounded-md border border-violet-400/40 px-2 py-1 text-xs text-violet-200"
                      onClick={() => void delistCase(row.project.id, row.name)}
                    >
                      <ShieldOff className="size-3" />
                      下架案例
                    </button>
                  ) : null}
                  {row.kind === "template" ? (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        className="inline-flex items-center gap-1 rounded-md border border-white/20 px-2 py-1 text-xs text-white/70"
                        onClick={() => void disableTemplate(row.template)}
                      >
                        <ShieldOff className="size-3" />
                        禁用
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        className="inline-flex items-center gap-1 rounded-md border border-red-400/40 px-2 py-1 text-xs text-red-200"
                        onClick={() => void removeTemplate(row.template)}
                      >
                        <X className="size-3" />
                        删除
                      </button>
                    </>
                  ) : null}
                </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      </div>

      {preview?.kind === "project" ? (
        <TemplatePreviewDialog
          name={preview.data.name}
          description={
            preview.data.portalFeaturedBlurb ||
            preview.data.portalCaseBlurb ||
            preview.data.description
          }
          thumbnailUrl={preview.data.thumbnailUrl}
          graph={preview.data.canvas as CanvasGraph}
          onClose={() => setPreview(null)}
        />
      ) : null}

      {preview?.kind === "template" ? (
        <TemplatePreviewDialog
          name={preview.data.name}
          description={preview.data.description}
          thumbnailUrl={preview.data.thumbnailUrl ?? preview.data.thumbnail}
          graph={preview.data.canvas as CanvasGraph}
          onClose={() => setPreview(null)}
        />
      ) : null}
    </div>
  );
}
