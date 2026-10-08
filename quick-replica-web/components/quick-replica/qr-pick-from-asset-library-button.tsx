"use client";

import { FolderOpen } from "lucide-react";

import { useAssetLibrary } from "@/docker-shared/global-asset-library";
import { pickItemRefUrl } from "@/docker-shared/global-asset-library/unified-asset-library-types";

type Props = {
  disabled?: boolean;
  maxSelect?: number;
  className?: string;
  onPickUrls: (urls: string[]) => void | Promise<void>;
};

export function QrPickFromAssetLibraryButton({
  disabled,
  maxSelect = 9,
  className,
  onPickUrls,
}: Props) {
  const { openAssetLibrary } = useAssetLibrary();

  return (
    <button
      type="button"
      disabled={disabled}
      className={
        className ??
        "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-medium text-[var(--qr-text-secondary)] transition hover:border-white/25 hover:bg-white/[0.04] disabled:opacity-50"
      }
      style={{ borderColor: "rgba(255,255,255,0.14)" }}
      onClick={() => {
        openAssetLibrary({
          app: "quick-replica",
          mode: "pick",
          title: "资产库",
          defaultSection: "shared",
          maxSelect,
          media: "image",
          onPickUnified: async (items) => {
            const urls = items.map((i) => pickItemRefUrl(i)).filter(Boolean);
            if (urls.length) await onPickUrls(urls);
          },
        });
      }}
    >
      <FolderOpen className="h-3.5 w-3.5 shrink-0" aria-hidden />
      从资产库选择
    </button>
  );
}
