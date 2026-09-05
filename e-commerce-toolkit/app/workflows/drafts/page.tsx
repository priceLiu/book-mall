"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, FolderOpen, Plus, Trash2 } from "lucide-react";

import { useDialogs } from "@/components/dialogs/dialog-provider";
import { EcomWorkspaceLayout } from "@/components/layout/ecom-workspace-layout";
import {
  ECOM_LIBRARY_MEDIA_GRID_CLASS,
} from "@/components/media/ecom-media-library-tile";
import { EcomMediaSkeletonGrid } from "@/components/media/ecom-media-skeleton";
import { EcomIconButton } from "@/components/ui/ecom-icon-button";
import { EcomIconToolbar, EcomIconToolbarGroup } from "@/components/ui/ecom-icon-toolbar";
import {
  deleteWorkflowDraft,
  formatWorkflowDraftUpdatedAt,
  openWorkflowDraft,
  startNewWorkflowDraft,
} from "@/lib/ecom-workflow-draft-navigation";
import {
  listWorkflowDrafts,
  type EcomWorkflowDraftItem,
  type EcomWorkflowDraftKind,
} from "@/lib/ecom-workflow-drafts-api";

type DraftTab = "all" | "ecom" | "video";

const NEW_DRAFT_OPTIONS: Array<{ kind: EcomWorkflowDraftKind; label: string }> = [
  { kind: "storyboard", label: "微剧 / 专业版故事版" },
  { kind: "product-design-main", label: "电商主图" },
  { kind: "product-design-detail", label: "电商详情页" },
  { kind: "hand-craft", label: "手伴创作" },
  { kind: "seed-video", label: "种草视频" },
  { kind: "media-decompose", label: "拆图拆视频" },
  { kind: "model-shot", label: "服装模特图" },
];

function groupDraftsByFeature(
  drafts: EcomWorkflowDraftItem[],
): Array<{ featureLabel: string; items: EcomWorkflowDraftItem[] }> {
  const map = new Map<string, EcomWorkflowDraftItem[]>();
  for (const item of drafts) {
    const list = map.get(item.featureLabel) ?? [];
    list.push(item);
    map.set(item.featureLabel, list);
  }
  return [...map.entries()].map(([featureLabel, items]) => ({
    featureLabel,
    items,
  }));
}

export default function WorkflowDraftsPage() {
  const router = useRouter();
  const { alert, doubleConfirm } = useDialogs();
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<EcomWorkflowDraftItem[]>([]);
  const [activeTab, setActiveTab] = useState<DraftTab>("all");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [newMenuOpen, setNewMenuOpen] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const items = await listWorkflowDrafts();
      setDrafts(items);
    } catch (e) {
      await alert({
        title: "加载失败",
        message: e instanceof Error ? e.message : "暂存列表加载失败",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [alert]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const filtered = useMemo(() => {
    if (activeTab === "all") return drafts;
    const domain = activeTab === "ecom" ? "电商" : "视频";
    return drafts.filter((d) => d.domainLabel === domain);
  }, [activeTab, drafts]);

  const grouped = useMemo(() => groupDraftsByFeature(filtered), [filtered]);

  const counts = useMemo(
    () => ({
      all: drafts.length,
      ecom: drafts.filter((d) => d.domainLabel === "电商").length,
      video: drafts.filter((d) => d.domainLabel === "视频").length,
    }),
    [drafts],
  );

  async function handleOpen(item: EcomWorkflowDraftItem) {
    setBusyKey(`open:${item.kind}:${item.projectId}`);
    try {
      openWorkflowDraft(router, item.kind, item.projectId);
    } finally {
      setBusyKey(null);
    }
  }

  async function handleNew(kind: EcomWorkflowDraftKind) {
    setNewMenuOpen(false);
    setBusyKey(`new:${kind}`);
    try {
      await startNewWorkflowDraft(router, kind);
      void reload();
    } catch (e) {
      await alert({
        title: "新建失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    } finally {
      setBusyKey(null);
    }
  }

  async function handleDelete(item: EcomWorkflowDraftItem) {
    if (
      !(await doubleConfirm({
        title: `删除暂存「${item.title}」？`,
        message: "将删除该进行中的工作流项目记录。",
        secondTitle: "确认删除，且不可恢复？",
        secondMessage:
          "已入库「我的资产」的成图/成片不会一并删除；仅删除暂存项目本身。",
        confirmLabel: "删除",
      }))
    ) {
      return;
    }
    const key = `delete:${item.kind}:${item.projectId}`;
    setBusyKey(key);
    try {
      await deleteWorkflowDraft(item.kind, item.projectId);
      setDrafts((prev) => prev.filter((d) => d.projectId !== item.projectId));
    } catch (e) {
      await alert({
        title: "删除失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <EcomWorkspaceLayout fullWidth>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <header className="shrink-0 border-b border-[#e8e8ed] bg-white px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-[#86868b]">
                我的工作流
              </p>
              <h1 className="text-lg font-semibold text-[#1d1d1f]">暂存</h1>
              <p className="mt-1 text-xs text-[#6e6e73]">
                各功能进行中的项目自动出现在此，可随时继续编辑或新建。
              </p>
            </div>
            <div className="relative">
              <EcomIconToolbar>
                <EcomIconToolbarGroup label="新建">
                  <EcomIconButton
                    label="新建工作流"
                    icon={Plus}
                    variant="accent"
                    onClick={() => setNewMenuOpen((v) => !v)}
                  />
                </EcomIconToolbarGroup>
              </EcomIconToolbar>
              {newMenuOpen ? (
                <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-[#e8e8ed] bg-white p-1 shadow-lg">
                  {NEW_DRAFT_OPTIONS.map((opt) => (
                    <button
                      key={opt.kind}
                      type="button"
                      className="flex w-full rounded-lg px-3 py-2 text-left text-xs text-[#1d1d1f] hover:bg-[#f5f5f7] disabled:opacity-50"
                      disabled={Boolean(busyKey?.startsWith("new:"))}
                      onClick={() => void handleNew(opt.kind)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {(
              [
                { id: "all" as const, label: "全部" },
                { id: "ecom" as const, label: "电商" },
                { id: "video" as const, label: "视频" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeTab === tab.id
                    ? "bg-[#1d1d1f] text-white"
                    : "bg-[#f5f5f7] text-[#6e6e73] hover:text-[#1d1d1f]"
                }`}
              >
                {tab.label}
                <span className="ml-1 opacity-70">({counts[tab.id]})</span>
              </button>
            ))}
            <Link
              href="/library"
              className="ml-auto text-xs text-[#0071e3] hover:underline"
            >
              我的资产 →
            </Link>
          </div>
        </header>

        <div className="ecom-scrollbar-thin min-h-0 flex-1 overflow-y-auto bg-white p-4 sm:p-6">
        {loading ? (
          <EcomMediaSkeletonGrid count={6} gridClass={ECOM_LIBRARY_MEDIA_GRID_CLASS} />
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#e8e8ed] bg-[#fafafa] px-6 py-16 text-center">
            <FolderOpen className="mx-auto mb-3 h-8 w-8 text-[#c7c7cc]" />
            <p className="text-sm font-medium text-[#1d1d1f]">暂无暂存工作流</p>
            <p className="mt-2 text-xs leading-relaxed text-[#6e6e73]">
              在故事版、主图、种草视频等功能中开始创作后，进度会自动保留在此。
              <br />
              点「保存工作流」后的可复用模板仍在
              <Link href="/library" className="mx-1 text-[#0071e3] hover:underline">
                我的资产 · 工作流
              </Link>
              。
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {grouped.map((group) => (
              <section key={group.featureLabel}>
                <h2 className="mb-3 text-xs font-semibold text-[#1d1d1f]">
                  {group.featureLabel}
                  <span className="ml-2 font-normal text-[#86868b]">
                    {group.items.length} 项
                  </span>
                </h2>
                <div className={ECOM_LIBRARY_MEDIA_GRID_CLASS}>
                  {group.items.map((item) => {
                    const openBusy = busyKey === `open:${item.kind}:${item.projectId}`;
                    const deleteBusy =
                      busyKey === `delete:${item.kind}:${item.projectId}`;
                    return (
                      <article
                        key={`${item.kind}:${item.projectId}`}
                        className="flex flex-col overflow-hidden rounded-2xl border border-[#e8e8ed] bg-white shadow-sm"
                      >
                        <div className="relative aspect-[4/5] bg-[#f5f5f7]">
                          {item.thumbnailUrl ? (
                            <Image
                              src={item.thumbnailUrl}
                              alt={item.title}
                              fill
                              className="object-cover"
                              unoptimized
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-[11px] text-[#86868b]">
                              暂无预览
                            </div>
                          )}
                        </div>
                        <div className="flex flex-1 flex-col gap-2 p-3">
                          <div>
                            <p className="line-clamp-2 text-sm font-medium text-[#1d1d1f]">
                              {item.title}
                            </p>
                            <p className="mt-1 text-[11px] text-[#86868b]">
                              {item.phaseLabel} · {item.summary}
                            </p>
                            <p className="mt-0.5 text-[10px] text-[#aeaeb2]">
                              更新于 {formatWorkflowDraftUpdatedAt(item.updatedAt)}
                            </p>
                          </div>
                          <div className="mt-auto">
                          <EcomIconToolbar>
                            <EcomIconToolbarGroup label="操作">
                              <EcomIconButton
                                label={openBusy ? "打开中…" : "继续编辑"}
                                icon={ExternalLink}
                                variant="accent"
                                busy={openBusy}
                                disabled={openBusy || deleteBusy}
                                onClick={() => void handleOpen(item)}
                              />
                              <EcomIconButton
                                label={deleteBusy ? "删除中…" : "删除暂存"}
                                icon={Trash2}
                                variant="destructive"
                                busy={deleteBusy}
                                disabled={openBusy || deleteBusy}
                                onClick={() => void handleDelete(item)}
                              />
                            </EcomIconToolbarGroup>
                          </EcomIconToolbar>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
        </div>
      </div>
    </EcomWorkspaceLayout>
  );
}
