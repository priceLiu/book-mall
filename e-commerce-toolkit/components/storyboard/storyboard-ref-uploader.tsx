"use client";

import Image from "next/image";
import { Plus, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { EcomButtonSecondary } from "@/components/ui/ecom-button";
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

  async function handleFiles(files: FileList | null, role: StoryboardReference["role"]) {
    if (!files?.length || busy) return;
    for (const file of Array.from(files)) {
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

  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      if (busy) return;
      const items = e.clipboardData?.items;
      if (!items?.length) return;

      const pasteRole = hoverRole ?? activeRole;
      const section = ROLE_SECTIONS.find((s) => s.role === pasteRole);
      if (!section) return;

      for (const item of Array.from(items)) {
        if (!item.type.startsWith("image/")) continue;
        const file = item.getAsFile();
        if (!file) continue;
        e.preventDefault();
        void uploadFile(file, section.refRole);
        break;
      }
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [hoverRole, activeRole, busy, uploadFile]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-[#6e6e73]">
          素材图
        </span>
        <span className="text-[10px] text-[#86868b]">鼠标移入分类后粘贴</span>
      </div>

      {ROLE_SECTIONS.map(({ role, title, refRole }) => {
        const items = references.filter((r) =>
          refRole === "other" ? r.role === "scene" || r.role === "other" : r.role === refRole,
        );
        const isHover = hoverRole === role;
        const isSuggested = activeRole === role;

        return (
          <div
            key={role}
            className={cn(
              "rounded-lg border px-2.5 py-2 transition-colors",
              isHover && "border-[#0071e3] bg-[#0071e3]/5 ring-1 ring-[#0071e3]/40",
              !isHover && isSuggested && "border-[#1d1d1f]/25 bg-white",
              !isHover && !isSuggested && "border-[#e8e8ed] bg-[#fafafa]",
            )}
            onMouseEnter={() => setHoverRole(role)}
            onMouseLeave={() => setHoverRole((prev) => (prev === role ? null : prev))}
          >
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <button
                type="button"
                className="text-xs font-semibold text-[#1d1d1f]"
                onClick={() => onActiveRoleChange?.(role)}
              >
                {title}
                {isHover ? (
                  <span className="ml-1.5 text-[10px] font-normal text-[#0071e3]">粘贴至此</span>
                ) : null}
              </button>
              <EcomButtonSecondary
                size="sm"
                type="button"
                disabled={busy}
                className="h-7 px-2 text-[10px]"
                onClick={() => openPicker(role)}
              >
                <Plus className="h-3 w-3 shrink-0" />
                上传
              </EcomButtonSecondary>
            </div>
            <input
              ref={(el) => {
                inputRefs.current[role] = el;
              }}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files, refRole)}
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
              <p className="text-[10px] text-[#86868b]">--</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
