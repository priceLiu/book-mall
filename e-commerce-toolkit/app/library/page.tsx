"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

import { useDialogs } from "@/components/dialogs/dialog-provider";
import { EcomHomeAssistant } from "@/components/layout/ecom-home-assistant";
import { EcomWorkspaceLayout } from "@/components/layout/ecom-workspace-layout";
import { EcomVideoPreviewDialog } from "@/components/media/ecom-video-preview-dialog";
import { EcomVideoThumb } from "@/components/media/ecom-video-player";
import { deleteAsset, listAssets, type EcomAsset } from "@/lib/ecom-api";

export default function LibraryPage() {
  const { confirm, doubleConfirm, alert } = useDialogs();
  const [assets, setAssets] = useState<EcomAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewVideo, setPreviewVideo] = useState<{ src: string; title?: string } | null>(
    null,
  );

  useEffect(() => {
    listAssets()
      .then(setAssets)
      .finally(() => setLoading(false));
  }, []);

  async function onDelete(a: EcomAsset) {
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
      setAssets((prev) => prev.filter((x) => x.id !== a.id));
    } catch (e) {
      await alert({
        title: "删除失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    }
  }

  return (
    <>
      <EcomWorkspaceLayout
        assistantHeader={
          <>
            <h1 className="text-lg font-semibold text-[#1d1d1f]">我的资产</h1>
            <p className="text-xs text-[#6e6e73]">
              {loading ? "加载中…" : `共 ${assets.length} 条`}
            </p>
          </>
        }
        assistant={<EcomHomeAssistant variant="library" />}
      >
        <div className="ecom-scrollbar-thin min-h-0 flex-1 overflow-y-auto px-6 py-6">
          {loading ? (
            <p className="text-sm text-[#6e6e73]">加载中…</p>
          ) : assets.length === 0 ? (
            <p className="text-sm text-[#6e6e73]">暂无资产，去各模块生成后会出现在这里。</p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {assets.map((a) => (
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
                        onClick={() =>
                          setPreviewVideo({
                            src: a.ossUrl,
                            title: a.title ?? a.module,
                          })
                        }
                      />
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2 p-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {a.title ?? "未命名"}
                      </p>
                      <p className="truncate text-xs text-[#6e6e73]">{a.module}</p>
                    </div>
                    <button
                      type="button"
                      className="shrink-0 text-sm text-red-600"
                      onClick={() => onDelete(a)}
                    >
                      删除
                    </button>
                  </div>
                </li>
              ))}
            </ul>
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
    </>
  );
}
