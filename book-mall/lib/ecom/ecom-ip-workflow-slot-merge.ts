/** 手办 / 品牌 VI 等 IP 工作流 · plan 槽位合并（并发出图回写） */

export type IpWorkflowPlanSlot = {
  index: number;
  imageUrl?: string | null;
  assetId?: string | null;
};

export function mergeIpWorkflowStepSlots<T extends IpWorkflowPlanSlot>(
  prev: T[],
  patch: T[],
): T[] {
  const prevBy = new Map(prev.map((s) => [s.index, s]));
  const patchBy = new Map(patch.map((s) => [s.index, s]));
  const indexes = [...new Set([...prevBy.keys(), ...patchBy.keys()])].sort(
    (a, b) => a - b,
  );
  return indexes.map((index) => {
    const p = prevBy.get(index);
    const n = patchBy.get(index);
    if (!n) return p!;
    if (!p) return n;
    const imageUrl = n.imageUrl?.trim() || p.imageUrl?.trim() || undefined;
    return {
      ...p,
      ...n,
      imageUrl,
      assetId: n.assetId ?? p.assetId ?? undefined,
    };
  });
}
