import { prisma } from "@/lib/prisma";

/** 从 persisted canvas JSON 提取节点 id 集合。 */
export function buildCanvasNodeIdSet(canvas: unknown): Set<string> {
  const ids = new Set<string>();
  if (!canvas || typeof canvas !== "object") return ids;
  const nodes = (canvas as { nodes?: unknown }).nodes;
  if (!Array.isArray(nodes)) return ids;
  for (const n of nodes) {
    if (n && typeof n === "object") {
      const id = (n as { id?: unknown }).id;
      if (typeof id === "string" && id.trim()) ids.add(id);
    }
  }
  return ids;
}

export async function loadCanvasNodeIdsByProjectForUser(
  userId: string,
  projectIds: string[],
): Promise<Map<string, Set<string>>> {
  const unique = [...new Set(projectIds.filter(Boolean))];
  if (!unique.length) return new Map();
  const rows = await prisma.canvasProject.findMany({
    where: { id: { in: unique }, userId, deletedAt: null },
    select: { id: true, canvas: true },
  });
  return new Map(rows.map((r) => [r.id, buildCanvasNodeIdSet(r.canvas)]));
}

export function attachNodePresentToGenerationRecords<
  T extends { nodeId: string; projectId?: string },
>(
  records: T[],
  nodeIdsByProject: Map<string, Set<string>>,
  defaultProjectId?: string,
): Array<T & { nodePresent: boolean | null }> {
  return records.map((row) => {
    if (!row.nodeId) return { ...row, nodePresent: null };
    const pid = row.projectId ?? defaultProjectId;
    if (!pid) return { ...row, nodePresent: false };
    const ids = nodeIdsByProject.get(pid);
    return { ...row, nodePresent: ids ? ids.has(row.nodeId) : false };
  });
}
