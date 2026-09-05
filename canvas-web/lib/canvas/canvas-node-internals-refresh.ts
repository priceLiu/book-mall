/** store→RF 推送后须重测 handle 的节点（含连线对端） */
export function collectNodeInternalsRefreshIds<
  N extends {
    id: string;
    position: { x: number; y: number };
    width?: number;
    height?: number;
    parentId?: string;
  },
  E extends { source: string; target: string },
>(prev: N[], next: N[], edges: E[]): string[] {
  const prevById = new Map(prev.map((n) => [n.id, n]));
  const changed = new Set<string>();
  for (const n of next) {
    const p = prevById.get(n.id);
    if (!p) continue;
    if (
      p.position.x !== n.position.x ||
      p.position.y !== n.position.y ||
      p.width !== n.width ||
      p.height !== n.height ||
      p.parentId !== n.parentId
    ) {
      changed.add(n.id);
    }
  }
  if (!changed.size) return [];
  const related = new Set(changed);
  for (const e of edges) {
    if (changed.has(e.source)) related.add(e.target);
    if (changed.has(e.target)) related.add(e.source);
  }
  return [...related];
}
