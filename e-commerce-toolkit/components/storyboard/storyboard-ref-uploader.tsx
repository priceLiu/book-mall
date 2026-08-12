"use client";

import { useCallback, useRef, useState } from "react";

import { EcomAssetPickerDialog } from "@/components/media/ecom-asset-picker-dialog";
import { EcomRefUploadCard } from "@/components/media/ecom-ref-upload-card";
import { IMAGE_UPLOAD_DROP_HINT } from "@/lib/image-upload-utils";
import type { StoryboardReference } from "@/lib/storyboard-types";
import type { StoryboardUploadRole } from "@/lib/storyboard-workflow";

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
      "不上传也可继续策划。上传后分镜与出图更贴近真实商品；支持 Ctrl+V / ⌘V 粘贴。",
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

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-[#6e6e73]">
          素材图
        </span>
        <span className="text-[10px] text-[#86868b]">{IMAGE_UPLOAD_DROP_HINT}</span>
      </div>

      {ROLE_SECTIONS.map(({ role, title, refRole, emptyHint }) => (
        <EcomRefUploadCard
          key={role}
          title={title}
          suggested={activeRole === role}
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
