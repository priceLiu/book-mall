"use client";

import { FolderOpen } from "lucide-react";
import { useState } from "react";

import { EcomProjectListDialog } from "@/components/layout/ecom-project-list-dialog";
import { EcomIconButton } from "@/components/ui/ecom-icon-button";
import type { EcomProjectListItem } from "@/lib/ecom-project-list-types";

type Props = {
  disabled?: boolean;
  currentProjectId?: string | null;
  loadProjects: () => Promise<EcomProjectListItem[]>;
  onSelectProject: (id: string) => void | Promise<void>;
  title?: string;
  description?: string;
  emptyHint?: string;
};

export function EcomProjectListButton({
  disabled,
  currentProjectId,
  loadProjects,
  onSelectProject,
  title,
  description,
  emptyHint,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <EcomIconButton
        label="项目列表"
        icon={FolderOpen}
        disabled={disabled}
        onClick={() => setOpen(true)}
      />
      <EcomProjectListDialog
        open={open}
        onOpenChange={setOpen}
        title={title}
        description={description}
        emptyHint={emptyHint}
        currentProjectId={currentProjectId}
        loadProjects={loadProjects}
        onSelectProject={onSelectProject}
      />
    </>
  );
}
