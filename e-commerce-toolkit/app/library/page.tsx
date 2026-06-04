"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useDialogs } from "@/components/dialogs/dialog-provider";
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
    <div className="mx-auto max-w-[1200px] px-6 py-12">
      <h1 className="text-[40px] font-semibold">我的资产</h1>
      <p className="mt-2 text-[var(--ecom-muted)]">全站生成的图片与视频</p>
      {loading ? (
        <p className="mt-8 text-sm">加载中…</p>
      ) : assets.length === 0 ? (
        <p className="mt-8 text-sm text-[var(--ecom-muted)]">
          暂无资产。<Link href="/" className="text-[var(--ecom-primary)]">去首页</Link> 开始创作。
        </p>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assets.map((a) => (
            <li
              key={a.id}
              className="overflow-hidden rounded-[18px] border border-[var(--ecom-hairline)] bg-white"
            >
              <div className="relative aspect-square">
                {a.kind === "image" ? (
                  <Image
                    src={a.thumbnailUrl ?? a.ossUrl}
                    alt=""
                    fill
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <EcomVideoThumb
                    src={a.ossUrl}
                    onClick={() =>
                      setPreviewVideo({ src: a.ossUrl, title: a.title ?? a.module })
                    }
                  />
                )}
              </div>
              <div className="flex justify-between p-3 text-sm">
                <span>{a.title ?? a.module}</span>
                <button
                  type="button"
                  className="text-red-600"
                  onClick={() => onDelete(a)}
                >
                  删除
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
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
    </div>
  );
}
