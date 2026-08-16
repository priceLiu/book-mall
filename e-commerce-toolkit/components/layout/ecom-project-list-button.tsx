"use client";

import { FolderOpen } from "lucide-react";
import { useState } from "react";

import { EcomProjectListDialog } from "@/components/layout/ecom-project-list-dialog";
import { EcomButtonSecondary } from "@/components/ui/ecom-button";
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
      <EcomButtonSecondary
        size="sm"
        type="button"
        dark
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <FolderOpen className="h-3.5 w-3.5 shrink-0" />
        项目列表
      </EcomButtonSecondary>
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
