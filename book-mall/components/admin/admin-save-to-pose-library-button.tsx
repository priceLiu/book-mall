"use client";

import { useState } from "react";

import { AdminPoseLibraryImportDialog } from "@/components/admin/admin-pose-library-import-dialog";

type Props = {
  imageUrl: string;
  prompt?: string | null;
  sourceModule?: string;
  sourceAssetId?: string;
  className?: string;
  label?: string;
};

/** 管理员成图卡片 · 保存到姿势库（PL-010） */
export function AdminSaveToPoseLibraryButton({
  imageUrl,
  prompt,
  sourceModule,
  sourceAssetId,
  className,
  label = "保存到姿势库",
}: Props) {
  const [open, setOpen] = useState(false);

  if (!imageUrl.trim()) return null;

  return (
    <>
      <button
        type="button"
        className={className ?? "text-[11px] text-[#0969da] underline"}
        onClick={() => setOpen(true)}
      >
        {label}
      </button>
      <AdminPoseLibraryImportDialog
        open={open}
        imageUrl={imageUrl}
        prompt={prompt}
        sourceModule={sourceModule}
        sourceAssetId={sourceAssetId}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
