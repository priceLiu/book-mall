"use client";

import { Link2 } from "lucide-react";
import { useRef, useState } from "react";

import { EcomAssetPickerDialog } from "@/components/media/ecom-asset-picker-dialog";
import { EcomRefUploadCard } from "@/components/media/ecom-ref-upload-card";
import { EcomVideoPreviewDialog } from "@/components/media/ecom-video-preview-dialog";
import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import { IMAGE_UPLOAD_DROP_HINT } from "@/lib/image-upload-utils";

type RefVideo = {
  ossUrl: string;
  label?: string;
};

type Props = {
  referenceVideo: RefVideo | null | undefined;
  busy?: boolean;
  /** 已拆解后锁定参考视频，避免误删；请用「重新拆解」重置流程 */
  referenceVideoLocked?: boolean;
  onUploadFile: (file: File) => Promise<void>;
  onImportUrl: (url: string) => Promise<void>;
  onAttachAsset: (assetId: string) => Promise<void>;
  onClear: () => Promise<void>;
};

export function OutfitVideoMediaInput({
  referenceVideo,
  busy,
  referenceVideoLocked,
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

  const items = referenceVideo?.ossUrl
    ? [
        {
          id: "ref-video",
          ossUrl: referenceVideo.ossUrl,
          label: referenceVideo.label ?? "参考视频",
          kind: "video" as const,
        },
      ]
    : [];

  async function handleFiles(files: File[]) {
    const file = files[0];
    if (!file || busy || referenceVideoLocked) return;
    await onUploadFile(file);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleUrlSubmit() {
    const url = urlDraft.trim();
    if (!url || busy || referenceVideoLocked) return;
    await onImportUrl(url);
    setUrlDraft("");
    setUrlOpen(false);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-[#6e6e73]">
          素材输入
          <span className="ml-1 font-normal normal-case text-[#ff3b30]">（必传 · 建议 9:16）</span>
        </span>
        <span className="text-[10px] text-[#86868b]">
          {items.length}/1 · {IMAGE_UPLOAD_DROP_HINT}
        </span>
      </div>

      <EcomRefUploadCard
        title="参考视频"
        items={items}
        emptyHint={`上传 1 段竖屏参考视频；也可粘贴 HTTPS 链接。${IMAGE_UPLOAD_DROP_HINT}`}
        removeLabel="删除参考视频"
        busy={busy || referenceVideoLocked}
        accept="video/*"
        multiple={false}
        allowVideo
        inputRef={inputRef}
        onOpenFilePicker={() => {
          if (referenceVideoLocked) return;
          inputRef.current?.click();
        }}
        onOpenAssetPicker={referenceVideoLocked ? undefined : () => setPickerOpen(true)}
        onUploadFiles={(files) => void handleFiles(files)}
        onRemove={referenceVideoLocked ? undefined : () => void onClear()}
        onPreviewItem={() => setPreviewOpen(true)}
        toolbarPrefix={
          <EcomButtonSecondary
            size="sm"
            type="button"
            disabled={busy || referenceVideoLocked}
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
            disabled={busy}
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
            disabled={busy || !urlDraft.trim()}
            onClick={() => void handleUrlSubmit()}
          >
            导入
          </EcomButtonPrimary>
        </div>
      ) : null}

      {referenceVideoLocked && referenceVideo?.ossUrl ? (
        <p className="text-[10px] leading-relaxed text-[#6e6e73]">
          已拆解，参考视频已锁定。如需换源视频请先新建项目；调整切点请点「重新拆解」。
        </p>
      ) : null}

      {busy ? (
        <div className="space-y-1">
          <div className="ecom-upload-progress ecom-upload-progress-indeterminate">
            <span />
          </div>
          <p className="text-[10px] text-[#0071e3]">正在处理视频…</p>
        </div>
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

      {referenceVideo?.ossUrl ? (
        <EcomVideoPreviewDialog
          src={referenceVideo.ossUrl}
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          title={referenceVideo.label ?? "参考视频"}
        />
      ) : null}
    </div>
  );
}
