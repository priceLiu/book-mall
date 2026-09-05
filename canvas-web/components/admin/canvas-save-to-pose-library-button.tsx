"use client";

import { useState } from "react";

import { CanvasPoseLibraryImportDialog } from "@/components/admin/canvas-pose-library-import-dialog";
import { useCanvasAdmin } from "@/components/home/use-canvas-admin";
import { cn } from "@/lib/utils";

type Props = {
  imageUrl: string;
  prompt?: string | null;
  sourceModule?: string;
  sourceAssetId?: string;
  className?: string;
  label?: string;
};

/** 管理员成图 · 保存到姿势库（仅 platform admin 可见） */
export function CanvasSaveToPoseLibraryButton({
  imageUrl,
  prompt,
  sourceModule,
  sourceAssetId,
  className,
  label = "保存到姿势库",
}: Props) {
  const isAdmin = useCanvasAdmin();
  const [open, setOpen] = useState(false);

  if (!isAdmin || !imageUrl.trim()) return null;

  return (
    <>
      <button
        type="button"
        className={cn(
          "nodrag text-[10px] text-[var(--canvas-accent)] underline-offset-2 hover:underline",
          className,
        )}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
      >
        {label}
      </button>
      <CanvasPoseLibraryImportDialog
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
