"use client";

import { useRef } from "react";

import { EcomRefUploadCard } from "@/components/media/ecom-ref-upload-card";
import { IMAGE_UPLOAD_ACCEPT, IMAGE_UPLOAD_DROP_HINT } from "@/lib/image-upload-utils";
import type { FilmPullCharacterRef } from "@/lib/film-pull-types";

type Props = {
  characterRefs: FilmPullCharacterRef[];
  characterDescription: string;
  onCharacterDescriptionChange: (value: string) => void;
  onUploadCharacter: (file: File) => Promise<void>;
  busy?: boolean;
};

/** 换角出镜 · 角色参考采集（对齐拆图复刻表单区） */
export function FilmPullReplaceSetupPanel({
  characterRefs,
  characterDescription,
  onCharacterDescriptionChange,
  onUploadCharacter,
  busy,
}: Props) {
  const characterInputRef = useRef<HTMLInputElement>(null);

  const characterItems = characterRefs.map((r) => ({
    id: r.id,
    ossUrl: r.ossUrl,
    label: r.label ?? "角色",
    kind: "image" as const,
  }));

  return (
    <div className="space-y-4 rounded-xl border border-[#e8e8ed] bg-white p-4">
      <div>
        <h3 className="text-sm font-semibold text-[#1d1d1f]">换角出镜 · 角色参考</h3>
        <p className="mt-1 text-[11px] leading-relaxed text-[#6e6e73]">
          上传新角色参考图并补充描述，渲染脚本将把原片人物替换为新角色后逐镜出视频。
        </p>
      </div>
      <EcomRefUploadCard
        title="角色图"
        items={characterItems}
        emptyHint={`上传角色参考图（可多张）。${IMAGE_UPLOAD_DROP_HINT}`}
        busy={busy}
        accept={IMAGE_UPLOAD_ACCEPT}
        multiple
        inputRef={characterInputRef}
        onOpenFilePicker={() => characterInputRef.current?.click()}
        onUploadFiles={(files) => {
          for (const file of files) {
            if (file.type.startsWith("image/")) void onUploadCharacter(file);
          }
        }}
      />
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-[#1d1d1f]" htmlFor="film-pull-character-desc">
          角色描述
        </label>
        <textarea
          id="film-pull-character-desc"
          className="w-full resize-y rounded-lg border border-[#d2d2d7] bg-[#fafafa] px-3 py-2.5 text-sm leading-relaxed outline-none placeholder:text-[#86868b] focus:border-[#0071e3] focus:bg-white focus:ring-2 focus:ring-[#0071e3]/20 disabled:opacity-60"
          rows={4}
          placeholder="例如：25 岁亚裔女性，黑色短发，休闲白 T，气质阳光…"
          value={characterDescription}
          disabled={busy}
          onChange={(e) => onCharacterDescriptionChange(e.target.value)}
        />
      </div>
    </div>
  );
}
