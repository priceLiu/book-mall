"use client";

import { ChevronDown, Upload } from "lucide-react";
import { useRef, useState } from "react";

import { EcomRefImageThumb } from "@/components/media/ecom-ref-image-thumb";
import { EcomButtonSecondary } from "@/components/ui/ecom-button";
import { useImageDropPaste } from "@/hooks/use-image-drop-paste";
import { buildSeedVideoMentionRefs } from "@/lib/seed-video-mention-refs";
import type { SeedVideoReference } from "@/lib/seed-video-types";
import { cn } from "@/lib/utils";

type Props = {
  shotIndex: number;
  refImageId: string;
  refImageLabel: string;
  references: SeedVideoReference[];
  disabled?: boolean;
  busy?: boolean;
  onAssign: (refId: string, refLabel: string) => void;
  onUpload: (file: File) => void | Promise<void>;
  onUnassign?: () => void;
};

export function SeedVideoShotRefCell({
  shotIndex,
  refImageId,
  refImageLabel,
  references,
  disabled,
  busy,
  onAssign,
  onUpload,
  onUnassign,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const materials = references.filter((r) => r.role === "seed-material" && r.ossUrl?.trim());
  const mentionRefs = buildSeedVideoMentionRefs(references);
  const assigned = materials.find((r) => r.id === refImageId);
  const thumbUrl = assigned?.ossUrl?.trim();
  const locked = Boolean(disabled) || Boolean(busy);

  const { dragOver, pasteReady, dropZoneProps } = useImageDropPaste({
    enabled: !locked,
    multiple: false,
    onFiles: (files) => {
      const file = files[0];
      if (file) void onUpload(file);
    },
  });

  function refLabelFor(id: string): string {
    const idx = materials.findIndex((r) => r.id === id);
    if (idx >= 0) return `@图片${idx + 1}`;
    return materials.find((r) => r.id === id)?.label ?? refImageLabel ?? `@图片${shotIndex}`;
  }

  return (
    <div
      className={cn(
        "relative min-w-[7.5rem] space-y-1.5 rounded-lg border border-dashed p-1.5 transition-colors",
        dragOver || pasteReady
          ? "border-[#0071e3] bg-[#f0f6ff]"
          : "border-[#e8e8ed] bg-[#fafafa]",
      )}
      {...dropZoneProps}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        disabled={locked}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void onUpload(file);
          e.target.value = "";
        }}
      />

      {thumbUrl ? (
        <EcomRefImageThumb
          src={thumbUrl}
          alt={refImageLabel || refLabelFor(refImageId)}
          size={48}
          onRemove={
            locked
              ? undefined
              : () => {
                  onUnassign?.();
                }
          }
          removeLabel="取消本镜参考"
        />
      ) : (
        <div className="flex h-12 items-center justify-center rounded-md border border-[#e8e8ed] bg-white px-2 text-[10px] leading-snug text-[#86868b]">
          上传 / 粘贴
        </div>
      )}

      <div className="flex flex-wrap gap-1">
        <EcomButtonSecondary
          type="button"
          size="sm"
          className="h-7 px-2 text-[10px]"
          disabled={locked}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="mr-0.5 h-3 w-3" />
          上传
        </EcomButtonSecondary>

        {materials.length > 0 ? (
          <div className="relative">
            <EcomButtonSecondary
              type="button"
              size="sm"
              className="h-7 px-2 text-[10px]"
              disabled={locked}
              onClick={() => setPickerOpen((v) => !v)}
            >
              选择
              <ChevronDown className="ml-0.5 h-3 w-3" />
            </EcomButtonSecondary>
            {pickerOpen ? (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-[40]"
                  aria-label="关闭参考图选择"
                  onClick={() => setPickerOpen(false)}
                />
                <div className="absolute left-0 top-full z-[50] mt-1 max-h-48 w-52 overflow-y-auto rounded-lg border border-[#e8e8ed] bg-white py-1 shadow-lg">
                  {materials.map((ref, i) => {
                    const label = mentionRefs[i]?.token ?? `@图片${i + 1}`;
                    return (
                      <button
                        key={ref.id}
                        type="button"
                        className={cn(
                          "flex w-full items-center gap-2 px-2 py-1.5 text-left text-[11px] hover:bg-[#f5f5f7]",
                          ref.id === refImageId && "bg-[#f0f6ff]",
                        )}
                        onClick={() => {
                          onAssign(ref.id, label);
                          setPickerOpen(false);
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={ref.ossUrl}
                          alt=""
                          className="h-8 w-8 shrink-0 rounded border border-[#e8e8ed] object-cover"
                        />
                        <span className="min-w-0 truncate text-[#1d1d1f]">{label}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
