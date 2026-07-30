"use client";

import Image from "next/image";
import { Plus, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";

import { EcomButtonSecondary } from "@/components/ui/ecom-button";
import { useImageDropPaste } from "@/hooks/use-image-drop-paste";
import type { StoryboardReference } from "@/lib/storyboard-types";
import type { StoryboardUploadRole } from "@/lib/storyboard-workflow";
import { cn } from "@/lib/utils";

type Props = {
  references: StoryboardReference[];
  onUpload: (file: File, opts: { label: string; role: StoryboardReference["role"] }) => Promise<void>;
  onRemove?: (id: string) => void | Promise<void>;
  busy?: boolean;
  /** 助手步骤建议的分类（高亮提示） */
  activeRole?: StoryboardUploadRole;
  onActiveRoleChange?: (role: StoryboardUploadRole) => void;
};

const ROLE_SECTIONS: Array<{
  role: StoryboardUploadRole;
  title: string;
  refRole: StoryboardReference["role"];
}> = [
  { role: "product", title: "产品图", refRole: "product" },
  { role: "character", title: "角色图", refRole: "character" },
  { role: "scene", title: "场景图", refRole: "scene" },
];

export function StoryboardRefUploader({
  references,
  onUpload,
  onRemove,
  busy,
  activeRole = "product",
  onActiveRoleChange,
}: Props) {
  const inputRefs = useRef<Record<StoryboardUploadRole, HTMLInputElement | null>>({
    product: null,
    character: null,
    scene: null,
  });
  const [hoverRole, setHoverRole] = useState<StoryboardUploadRole | null>(null);

  const uploadFile = useCallback(
    async (file: File, role: StoryboardReference["role"]) => {
      if (busy) return;
      const section = ROLE_SECTIONS.find((s) => s.refRole === role);
      const label = file.name.replace(/\.[^.]+$/, "").slice(0, 20) || section?.title || "场景图";
      await onUpload(file, { label, role });
    },
    [busy, onUpload],
  );

  async function handleFiles(files: File[], role: StoryboardReference["role"]) {
    if (!files.length || busy) return;
    for (const file of files) {
      await uploadFile(file, role);
    }
    const section = ROLE_SECTIONS.find((s) => s.refRole === role);
    if (section && inputRefs.current[section.role]) {
      inputRefs.current[section.role]!.value = "";
    }
  }

  function openPicker(role: StoryboardUploadRole) {
    onActiveRoleChange?.(role);
    inputRefs.current[role]?.click();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-[#6e6e73]">
          素材图
        </span>
        <span className="text-[10px] text-[#86868b]">拖放 / 移入后粘贴</span>
      </div>

      {ROLE_SECTIONS.map(({ role, title, refRole }) => (
        <StoryboardRefUploadSection
          key={role}
          role={role}
          title={title}
          refRole={refRole}
          items={references.filter((r) =>
            refRole === "other"
              ? r.role === "scene" || r.role === "other"
              : r.role === refRole,
          )}
          busy={busy}
          isHover={hoverRole === role}
          isSuggested={activeRole === role}
          onHover={() => setHoverRole(role)}
          onLeave={() => setHoverRole((prev) => (prev === role ? null : prev))}
          onActiveRoleChange={onActiveRoleChange}
          onOpenPicker={() => openPicker(role)}
          onUploadFiles={(files) => void handleFiles(files, refRole)}
          onRemove={onRemove}
          inputRef={(el) => {
            inputRefs.current[role] = el;
          }}
        />
      ))}
    </div>
  );
}

function StoryboardRefUploadSection({
  role,
  title,
  refRole,
  items,
  busy,
  isHover,
  isSuggested,
  onHover,
  onLeave,
  onActiveRoleChange,
  onOpenPicker,
  onUploadFiles,
  onRemove,
  inputRef,
}: {
  role: StoryboardUploadRole;
  title: string;
  refRole: StoryboardReference["role"];
  items: StoryboardReference[];
  busy?: boolean;
  isHover: boolean;
  isSuggested: boolean;
  onHover: () => void;
  onLeave: () => void;
  onActiveRoleChange?: (role: StoryboardUploadRole) => void;
  onOpenPicker: () => void;
  onUploadFiles: (files: File[]) => void;
  onRemove?: (id: string) => void | Promise<void>;
  inputRef: (el: HTMLInputElement | null) => void;
}) {
  const { dragOver, dropZoneProps } = useImageDropPaste({
    enabled: !busy,
    multiple: true,
    onFiles: onUploadFiles,
  });

  return (
    <div
      className={cn(
        "rounded-lg border px-2.5 py-2 transition-colors",
        (isHover || dragOver) && "border-[#0071e3] bg-[#0071e3]/5 ring-1 ring-[#0071e3]/40",
        !isHover && !dragOver && isSuggested && "border-[#1d1d1f]/25 bg-white",
        !isHover && !dragOver && !isSuggested && "border-[#e8e8ed] bg-[#fafafa]",
      )}
      onMouseEnter={() => {
        onHover();
        dropZoneProps.onMouseEnter?.();
      }}
      onMouseLeave={() => {
        onLeave();
        dropZoneProps.onMouseLeave?.();
      }}
      onFocus={dropZoneProps.onFocus}
      onBlur={dropZoneProps.onBlur}
      onDragOver={dropZoneProps.onDragOver}
      onDrop={dropZoneProps.onDrop}
      tabIndex={0}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <button
          type="button"
          className="text-xs font-semibold text-[#1d1d1f]"
          onClick={() => onActiveRoleChange?.(role)}
        >
          {title}
          {isHover || dragOver ? (
            <span className="ml-1.5 text-[10px] font-normal text-[#0071e3]">
              拖放 / 粘贴至此
            </span>
          ) : null}
        </button>
        <EcomButtonSecondary
          size="sm"
          type="button"
          disabled={busy}
          className="h-7 px-2 text-[10px]"
          onClick={onOpenPicker}
        >
          <Plus className="h-3 w-3 shrink-0" />
          上传
        </EcomButtonSecondary>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = e.target.files;
          if (files?.length) onUploadFiles(Array.from(files));
          e.target.value = "";
        }}
      />
      {items.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {items.map((r) => (
            <div
              key={r.id}
              className="group relative h-14 w-14 overflow-hidden rounded-md border border-[#d2d2d7] bg-white"
            >
              <Image
                src={r.ossUrl}
                alt={r.label}
                fill
                className="object-cover"
                unoptimized
              />
              {onRemove ? (
                <button
                  type="button"
                  className="absolute right-0.5 top-0.5 rounded-full bg-black/65 p-0.5 text-white"
                  onClick={() => void onRemove(r.id)}
                  aria-label={`删除${title}`}
                >
                  <X className="h-3 w-3" />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[10px] text-[#86868b]">拖放图片到此处，或移入后 Ctrl+V</p>
      )}
    </div>
  );
}
