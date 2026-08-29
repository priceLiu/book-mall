"use client";

import { useCallback, useRef, useState } from "react";

import { EcomAssetPickerDialog } from "@/components/media/ecom-asset-picker-dialog";
import { EcomRefUploadCard } from "@/components/media/ecom-ref-upload-card";
import { useImageDropPaste } from "@/hooks/use-image-drop-paste";
import { IMAGE_UPLOAD_DROP_HINT } from "@/lib/image-upload-utils";
import type { StoryboardReference } from "@/lib/storyboard-types";
import type { StoryboardUploadRole } from "@/lib/storyboard-workflow";
import { cn } from "@/lib/utils";

type Props = {
  references: StoryboardReference[];
  onUpload: (file: File, opts: { label: string; role: StoryboardReference["role"] }) => Promise<void>;
  onRemove?: (id: string) => void | Promise<void>;
  onAttachAssets?: (
    assetIds: string[],
    role: StoryboardReference["role"],
  ) => Promise<void>;
  busy?: boolean;
  activeRole?: StoryboardUploadRole;
  onActiveRoleChange?: (role: StoryboardUploadRole) => void;
};

const ROLE_SECTIONS: Array<{
  role: StoryboardUploadRole;
  title: string;
  refRole: StoryboardReference["role"];
  emptyHint: string;
}> = [
  {
    role: "product",
    title: "产品图",
    refRole: "product",
    emptyHint:
      "上传或粘贴产品图后，助手将自动检测并进入七维参数采集。",
  },
  {
    role: "character",
    title: "角色图",
    refRole: "character",
    emptyHint: "拖放图片到此处，或点击「上传」后 Ctrl+V / ⌘V 粘贴",
  },
  {
    role: "scene",
    title: "场景图",
    refRole: "scene",
    emptyHint: "拖放图片到此处，或点击「上传」后 Ctrl+V / ⌘V 粘贴",
  },
];

export function StoryboardRefUploader({
  references,
  onUpload,
  onRemove,
  onAttachAssets,
  busy,
  activeRole = "product",
  onActiveRoleChange,
}: Props) {
  const inputRefs = useRef<Record<StoryboardUploadRole, HTMLInputElement | null>>({
    product: null,
    character: null,
    scene: null,
  });
  const [pickerRole, setPickerRole] = useState<StoryboardReference["role"] | null>(null);

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

  const activeRefRole =
    ROLE_SECTIONS.find((s) => s.role === activeRole)?.refRole ?? "product";
  const activeRefRoleRef = useRef(activeRefRole);
  activeRefRoleRef.current = activeRefRole;

  const {
    pasteReady: sectionPasteReady,
    dropZoneProps: sectionPasteProps,
    focusZone: focusSectionPaste,
  } = useImageDropPaste({
    enabled: !busy,
    multiple: true,
    listenPaste: true,
    onFiles: (files) => void handleFiles(files, activeRefRoleRef.current),
  });

  return (
    <div
      {...sectionPasteProps}
      className={cn(
        "space-y-2 rounded-lg outline-none transition-shadow",
        sectionPasteReady && "ring-2 ring-[#0071e3]/20",
      )}
      onMouseEnter={(e) => {
        sectionPasteProps.onMouseEnter?.();
        e.currentTarget.focus({ preventScroll: true });
      }}
      onMouseLeave={sectionPasteProps.onMouseLeave}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-[#6e6e73]">
          素材图
        </span>
        <span className="text-[10px] text-[#86868b]">
          {IMAGE_UPLOAD_DROP_HINT}
          {sectionPasteReady ? " · 粘贴至当前选中项" : ""}
        </span>
      </div>

      {ROLE_SECTIONS.map(({ role, title, refRole, emptyHint }) => (
        <EcomRefUploadCard
          key={role}
          title={title}
          suggested={activeRole === role}
          listenPaste={false}
          items={references
            .filter((r) => r.role === refRole)
            .map((r) => ({ id: r.id, ossUrl: r.ossUrl, label: r.label }))}
          emptyHint={emptyHint}
          busy={busy}
          onUploadFiles={(files) => void handleFiles(files, refRole)}
          onOpenFilePicker={() => {
            onActiveRoleChange?.(role);
            inputRefs.current[role]?.click();
          }}
          onOpenAssetPicker={
            onAttachAssets
              ? () => {
                  onActiveRoleChange?.(role);
                  setPickerRole(refRole);
                }
              : undefined
          }
          onRemove={onRemove}
          removeLabel={`删除${title}`}
          onTitleClick={() => onActiveRoleChange?.(role)}
          onMouseEnterCard={() => {
            onActiveRoleChange?.(role);
            focusSectionPaste();
          }}
          inputRef={(el) => {
            inputRefs.current[role] = el;
          }}
        />
      ))}

      {onAttachAssets ? (
        <EcomAssetPickerDialog
          open={pickerRole !== null}
          onOpenChange={(open) => {
            if (!open) setPickerRole(null);
          }}
          onConfirm={async (assets) => {
            const role = pickerRole ?? "product";
            setPickerRole(null);
            await onAttachAssets(
              assets.map((a) => a.id),
              role,
            );
          }}
        />
      ) : null}
    </div>
  );
}
