"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Clapperboard, RotateCcw } from "lucide-react";

import { useDialogs } from "@/components/dialogs/dialog-provider";
import { EcomHomeAssistant } from "@/components/layout/ecom-home-assistant";
import { EcomWorkspaceLayout } from "@/components/layout/ecom-workspace-layout";
import { EcomVideoPreviewDialog } from "@/components/media/ecom-video-preview-dialog";
import { EcomVideoThumb } from "@/components/media/ecom-video-player";
import { StoryboardDeliverableReviewDialog } from "@/components/storyboard/storyboard-deliverable-review-dialog";
import { EcomPublishDialog } from "@/components/publish/ecom-publish-dialog";
import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import { deleteAsset, type EcomAsset } from "@/lib/ecom-api";
import {
  listLibrarySections,
  type EcomLibrarySection,
  type EcomLibraryStoryboardBundle,
} from "@/lib/ecom-library-api";
import { reuseStoryboardProject } from "@/lib/ecom-storyboard-api";
import type { StoryboardDeliverableSnapshot } from "@/lib/storyboard-types";

const STORYBOARD_STORAGE_KEY = "ecom-storyboard-active-project";

export default function LibraryPage() {
  const router = useRouter();
  const { confirm, doubleConfirm, alert } = useDialogs();
  const [sections, setSections] = useState<EcomLibrarySection[]>([]);
  const [totalAssets, setTotalAssets] = useState(0);
  const [totalBundles, setTotalBundles] = useState(0);
  const [loading, setLoading] = useState(true);
  const [previewVideo, setPreviewVideo] = useState<{ src: string; title?: string } | null>(
    null,
  );
  const [reviewSnapshot, setReviewSnapshot] =
    useState<StoryboardDeliverableSnapshot | null>(null);
  const [reuseBusy, setReuseBusy] = useState<string | null>(null);

  useEffect(() => {
    listLibrarySections()
      .then((data) => {
        setSections(data.sections);
        setTotalAssets(data.totalAssets);
        setTotalBundles(data.totalBundles);
      })
      .finally(() => setLoading(false));
  }, []);

  async function onDeleteAsset(a: EcomAsset) {
    if (
      !(await confirm({
        title: "删除资产",
        message: `确定删除「${a.title ?? a.module}」？`,
        variant: "destructive",
      }))
    ) {
      return;
    }
    if (
      !(await doubleConfirm({
        title: "再次确认",
        message: "此操作不可恢复。",
        secondTitle: "不可恢复",
        secondMessage:
          "删除后库记录将移除；若文件在云端存储（OSS）将尝试一并删除。",
        confirmLabel: "确认删除",
      }))
    ) {
      return;
    }
    try {
      await deleteAsset(a.id);
      setSections((prev) =>
        prev.map((section) => ({
          ...section,
          assets: section.assets.filter((x) => x.id !== a.id),
        })).filter((s) => s.assets.length > 0 || s.storyboardBundles.length > 0),
      );
      setTotalAssets((n) => Math.max(0, n - 1));
    } catch (e) {
      await alert({
        title: "删除失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    }
  }

  async function onReuseBundle(bundle: EcomLibraryStoryboardBundle) {
    const key = `${bundle.projectId}:${bundle.savedAt}`;
    setReuseBusy(key);
    try {
      const project = await reuseStoryboardProject(bundle.projectId, bundle.savedAt);
      if (typeof window !== "undefined") {
        sessionStorage.setItem(STORYBOARD_STORAGE_KEY, project.id);
      }
      router.push("/ecom/storyboard/micro-drama");
    } catch (e) {
      await alert({
        title: "复用失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    } finally {
      setReuseBusy(null);
    }
  }

  const empty = !loading && sections.length === 0;

  return (
    <>
      <EcomWorkspaceLayout
        assistantHeader={
          <>
            <h1 className="text-lg font-semibold text-[#1d1d1f]">我的资产</h1>
            <div className="mt-2">
              <EcomPublishDialog
                content="从电商工具箱发起的示例发布：请在资产详情中选择具体文案后使用。"
                triggerLabel="一键发布（示例）"
              />
            </div>
            <p className="text-xs text-[#6e6e73]">
              {loading
                ? "加载中…"
                : `共 ${totalAssets} 条媒体 · ${totalBundles} 套微剧交付包`}
            </p>
          </>
        }
        assistant={<EcomHomeAssistant variant="library" />}
      >
        <div className="ecom-scrollbar-thin min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
          {loading ? (
            <p className="text-sm text-[#6e6e73]">加载中…</p>
          ) : empty ? (
            <p className="text-sm text-[#6e6e73]">
              暂无资产，去各模块生成后会按左侧菜单分类出现在这里。
            </p>
          ) : (
            <div className="space-y-10">
              {sections.map((section) => (
                <LibrarySectionBlock
                  key={section.moduleId}
                  section={section}
                  reuseBusy={reuseBusy}
                  onDeleteAsset={onDeleteAsset}
                  onPreviewVideo={(src, title) => setPreviewVideo({ src, title })}
                  onReviewBundle={(snap) => setReviewSnapshot(snap)}
                  onReuseBundle={onReuseBundle}
                />
              ))}
            </div>
          )}
        </div>
      </EcomWorkspaceLayout>

      {previewVideo ? (
        <EcomVideoPreviewDialog
          src={previewVideo.src}
          title={previewVideo.title}
          open
          onOpenChange={(open) => {
            if (!open) setPreviewVideo(null);
          }}
        />
      ) : null}

      {reviewSnapshot ? (
        <StoryboardDeliverableReviewDialog
          open
          snapshot={reviewSnapshot}
          onOpenChange={(open) => {
            if (!open) setReviewSnapshot(null);
          }}
          onPreviewVideo={(src, title) => setPreviewVideo({ src, title })}
        />
      ) : null}
    </>
  );
}

function LibrarySectionBlock({
  section,
  reuseBusy,
  onDeleteAsset,
  onPreviewVideo,
  onReviewBundle,
  onReuseBundle,
}: {
  section: EcomLibrarySection;
  reuseBusy: string | null;
  onDeleteAsset: (a: EcomAsset) => void;
  onPreviewVideo: (src: string, title?: string) => void;
  onReviewBundle: (snap: StoryboardDeliverableSnapshot) => void;
  onReuseBundle: (bundle: EcomLibraryStoryboardBundle) => void;
}) {
  return (
    <section>
      <div className="mb-4 flex items-baseline gap-2">
        <h2 className="text-base font-semibold text-[#1d1d1f]">{section.title}</h2>
        <span className="text-xs text-[#86868b]">
          {section.storyboardBundles.length > 0
            ? `${section.storyboardBundles.length} 套交付包`
            : null}
          {section.storyboardBundles.length > 0 && section.assets.length > 0 ? " · " : null}
          {section.assets.length > 0 ? `${section.assets.length} 条媒体` : null}
        </span>
      </div>

      {section.storyboardBundles.length > 0 ? (
        <ul className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {section.storyboardBundles.map((bundle) => {
            const busy = reuseBusy === `${bundle.projectId}:${bundle.savedAt}`;
            return (
              <li
                key={`${bundle.projectId}-${bundle.savedAt}`}
                className="overflow-hidden rounded-[18px] border border-[#e8e8ed] bg-white"
              >
                <div className="relative aspect-video bg-[#f5f5f7]">
                  {bundle.thumbnailUrl ? (
                    <Image
                      src={bundle.thumbnailUrl}
                      alt={bundle.title}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[#86868b]">
                      <Clapperboard className="h-10 w-10 opacity-40" />
                    </div>
                  )}
                  <span className="absolute left-2 top-2 rounded-md bg-black/55 px-2 py-0.5 text-[10px] text-white">
                    {bundle.panelCount} 镜
                  </span>
                </div>
                <div className="space-y-3 p-4">
                  <div>
                    <p className="truncate text-sm font-medium">{bundle.title}</p>
                    <p className="mt-0.5 text-xs text-[#86868b]">
                      {new Date(bundle.savedAt).toLocaleString("zh-CN", { hour12: false })}
                    </p>
                    <p className="mt-1 text-xs text-[#6e6e73]">
                      {[
                        bundle.hasScript ? "含剧本" : null,
                        "含分镜",
                        bundle.snapshot.sheet.panels.some((p) => p.videoPromptEn)
                          ? "含提示词"
                          : null,
                        bundle.hasVideo ? "含成片" : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <EcomButtonSecondary
                      type="button"
                      className="flex-1"
                      onClick={() => onReviewBundle(bundle.snapshot)}
                    >
                      查看
                    </EcomButtonSecondary>
                    <EcomButtonPrimary
                      type="button"
                      className="flex-1"
                      disabled={busy}
                      onClick={() => onReuseBundle(bundle)}
                    >
                      <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                      {busy ? "复用中…" : "一键复用"}
                    </EcomButtonPrimary>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      {section.assets.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {section.assets.map((a) => (
            <li
              key={a.id}
              className="overflow-hidden rounded-[18px] border border-[#e8e8ed] bg-white"
            >
              <div className="relative aspect-square bg-[#f5f5f7]">
                {a.kind === "image" ? (
                  <Image
                    src={a.thumbnailUrl ?? a.ossUrl}
                    alt={a.title ?? ""}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <EcomVideoThumb
                    src={a.ossUrl}
                    onClick={() => onPreviewVideo(a.ossUrl, a.title ?? section.title)}
                  />
                )}
              </div>
              <div className="flex items-center justify-between gap-2 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{a.title ?? "未命名"}</p>
                  {a.prompt ? (
                    <p className="mt-0.5 line-clamp-2 text-xs text-[#86868b]">{a.prompt}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="shrink-0 text-sm text-red-600"
                  onClick={() => onDeleteAsset(a)}
                >
                  删除
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
