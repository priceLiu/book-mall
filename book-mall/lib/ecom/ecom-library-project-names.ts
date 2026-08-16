import type { MediaDecomposeDeliverableSnapshot } from "@/lib/ecom/ecom-media-decompose-snapshot";
import type { StoryboardDeliverableSnapshot } from "@/lib/ecom/ecom-storyboard-snapshot";
import type { SeedVideoDeliverableSnapshot } from "@/lib/ecom/ecom-seed-video-snapshot";
import type { ProductDesignWorkflowSnapshot } from "@/lib/ecom/ecom-product-design-snapshot";
import type { HandCraftWorkflowSnapshot } from "@/lib/ecom/ecom-hand-craft-snapshot";

export function buildProjectNameLookup(
  productDesignRows: Array<{
    id: string;
    brief: unknown;
    title: string | null;
    meta: unknown;
  }>,
  storyboardRows: Array<{ id: string; meta: unknown }>,
  seedVideoRows: Array<{ id: string; meta: unknown; title: string | null }> = [],
  handCraftRows: Array<{ id: string; meta: unknown; title: string | null }> = [],
  mediaDecomposeRows: Array<{ id: string; meta: unknown; title: string | null }> = [],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of productDesignRows) {
    const brief = row.brief as { productName?: string } | null;
    const fromBrief = brief?.productName?.trim();
    const fromTitle = row.title?.trim();
    if (fromBrief) map.set(row.id, fromBrief);
    else if (fromTitle) map.set(row.id, fromTitle);

    const meta = row.meta as Record<string, unknown> | null;
    const snap = meta?.workflowSnapshot as ProductDesignWorkflowSnapshot | undefined;
    if (snap?.productName?.trim()) map.set(row.id, snap.productName.trim());
    else if (snap?.title?.trim()) map.set(row.id, snap.title.trim());
  }
  for (const row of storyboardRows) {
    const meta = row.meta as Record<string, unknown> | null;
    const snap = meta?.deliverableSnapshot as StoryboardDeliverableSnapshot | undefined;
    if (snap?.productName?.trim()) map.set(row.id, snap.productName.trim());
    else if (snap?.title?.trim()) map.set(row.id, snap.title.trim());
  }
  for (const row of seedVideoRows) {
    const fromTitle = row.title?.trim();
    if (fromTitle) map.set(row.id, fromTitle);
    const meta = row.meta as Record<string, unknown> | null;
    const snap = meta?.deliverableSnapshot as SeedVideoDeliverableSnapshot | undefined;
    if (snap?.title?.trim()) map.set(row.id, snap.title.trim());
  }
  for (const row of handCraftRows) {
    const fromTitle = row.title?.trim();
    if (fromTitle) map.set(row.id, fromTitle);
    const meta = row.meta as Record<string, unknown> | null;
    const snap = meta?.workflowSnapshot as HandCraftWorkflowSnapshot | undefined;
    if (snap?.ipName?.trim()) map.set(row.id, snap.ipName.trim());
    else if (snap?.title?.trim()) map.set(row.id, snap.title.trim());
  }
  for (const row of mediaDecomposeRows) {
    const fromTitle = row.title?.trim();
    if (fromTitle) map.set(row.id, fromTitle);
    const meta = row.meta as Record<string, unknown> | null;
    const snap = meta?.deliverableSnapshot as MediaDecomposeDeliverableSnapshot | undefined;
    if (snap?.title?.trim()) map.set(row.id, snap.title.trim());
  }
  return map;
}

export function resolveAssetProjectName(
  meta: Record<string, unknown> | null | undefined,
  lookup: Map<string, string>,
): { projectId: string | null; projectName: string } {
  const projectId =
    typeof meta?.projectId === "string" && meta.projectId.trim()
      ? meta.projectId.trim()
      : null;
  const fromMeta =
    typeof meta?.projectName === "string" && meta.projectName.trim()
      ? meta.projectName.trim()
      : null;
  const fromLookup = projectId ? lookup.get(projectId)?.trim() : undefined;
  const projectName = fromMeta || fromLookup || "未命名项目";
  return { projectId, projectName };
}
