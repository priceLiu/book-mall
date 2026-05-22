"use client";

import { RequireAuth } from "@/components/auth/require-auth";
import { ProjectWorkspaceClient } from "@/components/project-workspace/project-workspace-client";

export function ProjectPageClient({ projectId }: { projectId: string }) {
  return (
    <RequireAuth>
      <ProjectWorkspaceClient projectId={projectId} />
    </RequireAuth>
  );
}
