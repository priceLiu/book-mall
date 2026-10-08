import type { IpWorkflowPlanSlot } from "@/lib/ecom/ecom-ip-workflow-slot-merge";

export type IpWorkflowStepBatchStatus = "pending" | "generating" | "ready";

/** 批次结束只改 step.status，slots 以库内 merge 结果为准，禁止用本批次内存快照整表覆盖 */
export async function finalizeIpWorkflowStepAfterBatch(opts: {
  slotsSnapshot: IpWorkflowPlanSlot[];
  wantedIndexes: number[];
  generated: number;
  failures: Array<{ index: number; message: string }>;
  readStepSlots: () => Promise<IpWorkflowPlanSlot[]>;
  patchStep: (patch: { status: IpWorkflowStepBatchStatus }) => Promise<void>;
}): Promise<void> {
  const dbSlots = await opts.readStepSlots();
  const attempted = new Set<number>();
  for (const s of opts.slotsSnapshot) {
    if (opts.wantedIndexes.includes(s.index) && s.imageUrl?.trim()) {
      attempted.add(s.index);
    }
  }
  for (const f of opts.failures) attempted.add(f.index);

  const extraFailures: Array<{ index: number; message: string }> = [];
  for (const index of opts.wantedIndexes) {
    if (attempted.has(index)) continue;
    const inDb = dbSlots.find((s) => s.index === index)?.imageUrl?.trim();
    if (inDb) continue;
    extraFailures.push({
      index,
      message: "本批次未执行到该槽（可能因连接超时或上一批仍在进行），请单独重试",
    });
  }

  const allFailures = [...opts.failures, ...extraFailures];
  const allDone =
    dbSlots.length > 0 && dbSlots.every((s) => Boolean(s.imageUrl?.trim()));

  await opts.patchStep({
    status: allDone ? "ready" : "pending",
  });

  if (extraFailures.length > 0) {
    opts.failures.push(...extraFailures);
  }
}
