import { ecomBookFetch } from "@/lib/ecom-book-fetch";
import type {
  MainImageHitReplicaProject,
  MainImageHitReplicaSummary,
} from "@/lib/main-image-hit-replica-types";

const BASE = "api/sso/tools/ecom/main-image-hit-replica";

export async function listMainImageHitReplicaSummaries(): Promise<MainImageHitReplicaSummary[]> {
  const data = await ecomBookFetch(`${BASE}/projects?summary=1`);
  return (data.items as MainImageHitReplicaSummary[]) ?? [];
}

export async function createMainImageHitReplicaProject(opts?: {
  title?: string;
}): Promise<MainImageHitReplicaProject> {
  const data = await ecomBookFetch(`${BASE}/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts ?? {}),
  });
  return data.project as MainImageHitReplicaProject;
}

export async function getMainImageHitReplicaProject(
  id: string,
): Promise<MainImageHitReplicaProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${id}`);
  return data.project as MainImageHitReplicaProject;
}

export async function updateMainImageHitReplicaProject(
  id: string,
  patch: {
    title?: string;
    settings?: Partial<MainImageHitReplicaProject["settings"]>;
    meta?: Partial<MainImageHitReplicaProject["meta"]>;
    output?: MainImageHitReplicaProject["output"];
    references?: MainImageHitReplicaProject["references"];
  },
): Promise<MainImageHitReplicaProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return data.project as MainImageHitReplicaProject;
}

export async function uploadMainImageHitReplicaRef(
  projectId: string,
  file: File,
  opts: { role: "reference" | "product"; label?: string },
): Promise<MainImageHitReplicaProject> {
  const form = new FormData();
  form.set("file", file);
  form.set("role", opts.role);
  if (opts.label) form.set("label", opts.label);
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/upload`, {
    method: "POST",
    body: form,
  });
  return data.project as MainImageHitReplicaProject;
}

export async function removeMainImageHitReplicaRef(
  projectId: string,
  refId: string,
): Promise<MainImageHitReplicaProject> {
  const data = await ecomBookFetch(
    `${BASE}/projects/${projectId}/upload?refId=${encodeURIComponent(refId)}`,
    { method: "DELETE" },
  );
  return data.project as MainImageHitReplicaProject;
}

export async function replicateMainImageHit(
  projectId: string,
  opts?: { modelKey?: string; visionModelKey?: string },
): Promise<{
  project: MainImageHitReplicaProject;
  generated: number;
  failures: Array<{ resultId: string; message: string }>;
}> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/replicate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts ?? {}),
  });
  return {
    project: data.project as MainImageHitReplicaProject,
    generated: Number(data.generated) || 0,
    failures: (data.failures as Array<{ resultId: string; message: string }>) ?? [],
  };
}