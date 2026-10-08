"use client";

import { useEffect, useRef } from "react";

import { useAssetLibrary } from "@/docker-shared/global-asset-library";
import { openEcomProjectAssetsPick } from "@/lib/ecom-asset-library-pick";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (
    assets: Array<{ id: string; ossUrl: string; title: string }>,
  ) => void | Promise<void>;
  maxSelect?: number;
  /** 为 true 时同时展示图片与视频资产（拆图拆视频等） */
  allowVideo?: boolean;
  /** 打开弹层时默认选中的资产分组（如模特试衣选模特） */
  defaultModule?: string;
};

/** 薄封装 · 打开统一资产库「本项目」Tab */
export function EcomAssetPickerDialog({
  open,
  onOpenChange,
  onConfirm,
  maxSelect = 8,
  allowVideo = false,
  defaultModule,
}: Props) {
  const { openAssetLibrary } = useAssetLibrary();
  const launchedRef = useRef(false);

  useEffect(() => {
    if (!open) {
      launchedRef.current = false;
      return;
    }
    if (launchedRef.current) return;
    launchedRef.current = true;
    onOpenChange(false);
    openEcomProjectAssetsPick(openAssetLibrary, {
      maxSelect,
      allowVideo,
      defaultModule,
      onConfirm,
    });
  }, [allowVideo, defaultModule, maxSelect, onConfirm, onOpenChange, open, openAssetLibrary]);

  return null;
}
