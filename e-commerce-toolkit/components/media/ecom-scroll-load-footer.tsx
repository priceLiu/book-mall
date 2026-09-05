"use client";

import type { RefObject } from "react";

import {
  EcomMediaSkeletonGrid,
  type EcomMediaSkeletonAspect,
} from "@/components/media/ecom-media-skeleton";

type Props = {
  sentinelRef: RefObject<HTMLDivElement>;
  hasMore: boolean;
  loadingMore: boolean;
  gridClass: string;
  skeletonAspect?: EcomMediaSkeletonAspect;
  /** 加载中展示的占位卡片数（默认 6 ≈ 一行） */
  skeletonCount?: number;
  idleLabel?: string;
  loadingLabel?: string;
};

/**
 * 画廊滚动加载底部：空闲提示 + 加载中骨架行与 indeterminate 进度条。
 * 对齐 QuickReplica 世界场景墙懒加载反馈（浅色变体）。
 */
export function EcomScrollLoadFooter({
  sentinelRef,
  hasMore,
  loadingMore,
  gridClass,
  skeletonAspect = "square",
  skeletonCount = 6,
  idleLabel = "向下滚动加载更多…",
  loadingLabel = "加载中…",
}: Props) {
  if (!hasMore) return null;

  return (
    <div
      ref={sentinelRef}
      className="py-6"
      aria-live="polite"
      aria-busy={loadingMore}
    >
      {loadingMore ? (
        <div className="space-y-4">
          <EcomMediaSkeletonGrid
            count={skeletonCount}
            gridClass={gridClass}
            aspect={skeletonAspect}
          />
          <div className="mx-auto w-[min(240px,70%)]">
            <div className="ecom-upload-progress ecom-upload-progress-indeterminate">
              <span />
            </div>
          </div>
          <p className="text-center text-xs text-[#86868b]">{loadingLabel}</p>
        </div>
      ) : (
        <p className="text-center text-xs text-[#86868b]">{idleLabel}</p>
      )}
    </div>
  );
}
