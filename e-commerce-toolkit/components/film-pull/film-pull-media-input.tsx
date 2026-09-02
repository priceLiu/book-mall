"use client";

import { Link2 } from "lucide-react";
import { useRef, useState } from "react";

import { EcomAssetPickerDialog } from "@/components/media/ecom-asset-picker-dialog";
import { EcomRefUploadCard } from "@/components/media/ecom-ref-upload-card";
import { EcomVideoPreviewDialog } from "@/components/media/ecom-video-preview-dialog";
import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import {
  IMAGE_OR_VIDEO_UPLOAD_ACCEPT,
  IMAGE_UPLOAD_DROP_HINT,
} from "@/lib/image-upload-utils";
import { filmPullMaxVideoSecLabel } from "@/lib/film-pull-limits";
import type { FilmPullMediaReference } from "@/lib/film-pull-types";

type Props = {
  media: FilmPullMediaReference | null;
  busy?: boolean;
  /** 拉片进行中：禁止删换源视频 */
  locked?: boolean;
  onUploadFile: (file: File) => Promise<void>;
  onImportUrl: (url: string) => Promise<void>;
  onAttachAsset: (assetId: string) => Promise<void>;
  onClear: () => Promise<void>;
};

export function FilmPullMediaInput({
  media,
  busy,
  locked,
  onUploadFile,
  onImportUrl,
  onAttachAsset,
  onClear,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [urlOpen, setUrlOpen] = useState(false);
  const [urlDraft, setUrlDraft] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);

  const items = media?.ossUrl
    ? [
        {
          id: media.id,
          ossUrl: media.ossUrl,
          label: media.label ?? "视频素材",
          kind: "video" as const,
        },
      ]
    : [];

  async function handleFiles(files: File[]) {
    const file = files[0];
    if (!file || busy || locked) return;
    await onUploadFile(file);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleUrlSubmit() {
    const url = urlDraft.trim();
    if (!url || busy || locked) return;
    await onImportUrl(url);
    setUrlDraft("");
    setUrlOpen(false);
  }

  const inputDisabled = busy || locked;

  const maxLabel = filmPullMaxVideoSecLabel();

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-[#6e6e73]">
          素材输入
          <span className="ml-1 font-normal normal-case text-[#ff3b30]">（必传 · {maxLabel} 视频）</span>
        </span>
        <span className="text-[10px] text-[#86868b]">
          {items.length}/1 · {IMAGE_UPLOAD_DROP_HINT}
        </span>
      </div>

      <EcomRefUploadCard
        title="视频"
        items={items}
        emptyHint={`上传 1 段视频（${maxLabel}）；也可粘贴 HTTPS 链接。${IMAGE_UPLOAD_DROP_HINT}`}
        removeLabel={locked ? "拉片中不可删除" : "删除素材"}
        busy={inputDisabled}
        accept={IMAGE_OR_VIDEO_UPLOAD_ACCEPT}
        multiple={false}
        allowVideo
        inputRef={inputRef}
        onOpenFilePicker={() => inputRef.current?.click()}
        onOpenAssetPicker={() => setPickerOpen(true)}
        onUploadFiles={(files) => void handleFiles(files)}
        onRemove={locked ? undefined : () => void onClear()}
        onPreviewItem={() => setPreviewOpen(true)}
        toolbarPrefix={
          <EcomButtonSecondary
            size="sm"
            type="button"
            disabled={inputDisabled}
            className="h-7 px-2 text-[10px]"
            onClick={() => setUrlOpen((open) => !open)}
          >
            <Link2 className="h-3 w-3 shrink-0" />
            粘贴链接
          </EcomButtonSecondary>
        }
      />

      {urlOpen ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="url"
            value={urlDraft}
            disabled={inputDisabled}
            placeholder="https:// 公网视频地址"
            className="min-w-0 flex-1 rounded-lg border border-[#d2d2d7] px-3 py-2 text-sm outline-none focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/20"
            onChange={(e) => setUrlDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleUrlSubmit();
            }}
          />
          <EcomButtonPrimary
            size="sm"
            type="button"
            disabled={inputDisabled || !urlDraft.trim()}
            onClick={() => void handleUrlSubmit()}
          >
            导入
          </EcomButtonPrimary>
        </div>
      ) : null}

      {busy ? (
        <div className="space-y-1">
          <div className="ecom-upload-progress ecom-upload-progress-indeterminate">
            <span />
          </div>
          <p className="text-[10px] text-[#0071e3]">正在处理素材…</p>
        </div>
      ) : locked ? (
        <p className="text-[10px] text-[#86868b]">拉片进行中，源视频已锁定</p>
      ) : null}

      <EcomAssetPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        maxSelect={1}
        allowVideo
        onConfirm={async (assets) => {
          setPickerOpen(false);
          const first = assets[0];
          if (first) await onAttachAsset(first.id);
        }}
      />

      {media?.ossUrl ? (
        <EcomVideoPreviewDialog
          src={media.ossUrl}
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          title={media.label ?? "视频素材"}
        />
      ) : null}
    </div>
  );
}
