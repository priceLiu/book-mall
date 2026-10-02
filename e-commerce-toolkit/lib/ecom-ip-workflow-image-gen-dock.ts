/** 手办 / 品牌 VI 等 IP 工作流 · 槽位批量出图 · 右下角 Dock 任务 id 与进度 */

export const ECOM_IP_WORKFLOW_MS_PER_SLOT = 120_000;

/** 出图进行中拉项目 plan（槽位逐张落库） */
export const ECOM_IP_WORKFLOW_PROJECT_POLL_MS = 350;

export function ipWorkflowImageGenTaskId(projectId: string, jobId: string): string {
  return `ip-workflow-gen:${projectId}:${jobId}`;
}

export type IpWorkflowSlotLike = { index: number; imageUrl?: string | null };

export function countIpWorkflowSlotsDone(
  slots: IpWorkflowSlotLike[],
  indexes: number[],
): number {
  return indexes.filter((i) => Boolean(slots.find((s) => s.index === i)?.imageUrl?.trim()))
    .length;
}

export function pendingIpWorkflowSlotIndexes(
  slots: IpWorkflowSlotLike[],
  indexes: number[],
): number[] {
  return indexes.filter((i) => !ipWorkflowSlotHasImage(slots, i));
}

export function ipWorkflowSlotHasImage(
  slots: IpWorkflowSlotLike[],
  index: number,
): boolean {
  return Boolean(slots.find((s) => s.index === index)?.imageUrl?.trim());
}

/** 服务端本步批次已结束（非 generating），空槽不应再扫光 */
export function ipWorkflowServerBatchEnded(stepStatus: string): boolean {
  return stepStatus !== "generating";
}

/**
 * 槽位扫光：有图永不扫；服务端 generating 时本步空槽可扫；
 * 本地 job 仅在「服务端仍在 generating」或「首轮 HTTP 未收到 generating 前」扫。
 */
export function ipWorkflowSlotUiGenerating(input: {
  stepStatus: string;
  slots: IpWorkflowSlotLike[];
  index: number;
  indexInActiveJob: boolean;
  localJobInFlight?: boolean;
}): boolean {
  if (ipWorkflowSlotHasImage(input.slots, input.index)) return false;

  if (input.stepStatus === "generating") {
    return input.indexInActiveJob;
  }

  if (!input.indexInActiveJob) return false;

  if (ipWorkflowServerBatchEnded(input.stepStatus)) return false;

  return Boolean(input.localJobInFlight);
}

/** 点击生成后立即乐观标 generating，避免等长轮询 HTTP 才更新 UI */
export function withIpWorkflowStepGenerating<T extends IpWorkflowProjectLike>(
  project: T,
  stepId: string,
): T {
  const step = project.plan?.steps?.[stepId];
  if (!step) return project;
  return {
    ...project,
    plan: {
      ...project.plan,
      steps: {
        ...project.plan!.steps,
        [stepId]: { ...step, status: "generating" },
      },
    },
  };
}

type IpWorkflowSlotWithAsset = IpWorkflowSlotLike & { assetId?: string | null };

function mergeIpWorkflowSlot(
  prev: IpWorkflowSlotWithAsset | undefined,
  next: IpWorkflowSlotWithAsset,
): IpWorkflowSlotWithAsset {
  if (!prev) return next;
  return {
    ...next,
    imageUrl: next.imageUrl?.trim() || prev.imageUrl?.trim() || undefined,
    assetId: next.assetId ?? prev.assetId ?? undefined,
  };
}

function mergeIpWorkflowSlotList(
  prev: IpWorkflowSlotWithAsset[] | undefined,
  next: IpWorkflowSlotWithAsset[] | undefined,
): IpWorkflowSlotWithAsset[] {
  const prevList = prev ?? [];
  const nextList = next ?? [];
  const prevByIndex = new Map(prevList.map((s) => [s.index, s]));
  const nextByIndex = new Map(nextList.map((s) => [s.index, s]));
  const indexes = [...new Set([...prevByIndex.keys(), ...nextByIndex.keys()])].sort(
    (a, b) => a - b,
  );
  return indexes.map((index) => {
    const n = nextByIndex.get(index);
    const p = prevByIndex.get(index);
    if (n && p) return mergeIpWorkflowSlot(p, n);
    return (n ?? p)!;
  });
}

type IpWorkflowPlanLike = {
  steps?: Record<
    string,
    {
      slots?: IpWorkflowSlotWithAsset[];
      outputs?: Array<{ imageUrl?: string | null; pageIndex?: number }>;
      [key: string]: unknown;
    }
  >;
};

type IpWorkflowProjectLike = {
  updatedAt?: string;
  plan?: IpWorkflowPlanLike;
};

function countPlanSlotImages(plan: IpWorkflowPlanLike | undefined): number {
  let n = 0;
  for (const step of Object.values(plan?.steps ?? {})) {
    for (const s of step.slots ?? []) {
      if (s.imageUrl?.trim()) n += 1;
    }
    for (const o of step.outputs ?? []) {
      if (o.imageUrl?.trim()) n += 1;
    }
  }
  return n;
}

/**
 * 轮询/生成响应写入 Studio 时合并 plan：永不因滞后快照抹掉已有 imageUrl。
 */
export function mergeEcomIpWorkflowProject<T extends IpWorkflowProjectLike>(
  prev: T,
  incoming: T,
): T {
  if (!prev.plan?.steps) return incoming;
  if (!incoming.plan?.steps) return incoming;

  const stepIds = new Set([
    ...Object.keys(prev.plan.steps),
    ...Object.keys(incoming.plan.steps),
  ]);
  const steps: NonNullable<IpWorkflowPlanLike["steps"]> = {
    ...prev.plan.steps,
    ...incoming.plan.steps,
  };

  for (const stepId of stepIds) {
    const pStep = prev.plan.steps[stepId];
    const nStep = incoming.plan.steps[stepId];
    if (!nStep && pStep) {
      steps[stepId] = pStep;
      continue;
    }
    if (!nStep) continue;
    if (!pStep) {
      steps[stepId] = nStep;
      continue;
    }
    const mergedOutputs = (nStep.outputs ?? []).map((o, i) => {
      const po = pStep.outputs?.[i];
      if (!po?.imageUrl?.trim()) return o;
      return {
        ...o,
        imageUrl: o.imageUrl?.trim() || po.imageUrl,
      };
    });
    const mergedSlots = mergeIpWorkflowSlotList(pStep.slots, nStep.slots);
    const mergedStatus = mergeIpWorkflowStepStatus(
      pStep.status as string | undefined,
      nStep.status as string | undefined,
      mergedSlots,
    );
    steps[stepId] = {
      ...nStep,
      status: mergedStatus,
      slots: mergedSlots,
      outputs:
        mergedOutputs.length > 0 ? mergedOutputs : (pStep.outputs ?? nStep.outputs),
    };
  }

  const merged = {
    ...incoming,
    plan: { ...incoming.plan, steps },
  } as T;

  const prevImages = countPlanSlotImages(prev.plan);
  const incomingImages = countPlanSlotImages(incoming.plan);
  const mergedImages = countPlanSlotImages(merged.plan);

  if (incomingImages > mergedImages) {
    const favorIncoming = mergeEcomIpWorkflowProject(incoming, prev);
    return { ...incoming, plan: favorIncoming.plan } as T;
  }
  if (mergedImages < prevImages && prev.updatedAt && incoming.updatedAt) {
    if (incoming.updatedAt < prev.updatedAt) {
      return { ...prev, plan: merged.plan } as T;
    }
  }

  return merged;
}

/** Studio 写入：合并后若仍少于 incoming 的出图数，再以 incoming 为基准合并一次 */
export function applyEcomIpWorkflowProjectSnapshot<T extends IpWorkflowProjectLike>(
  prev: T | null | undefined,
  incoming: T,
): T {
  if (!prev) return incoming;
  const prevId = (prev as { id?: string }).id;
  const incomingId = (incoming as { id?: string }).id;
  if (prevId && incomingId && prevId !== incomingId) return incoming;

  const merged = mergeEcomIpWorkflowProject(prev, incoming);
  const prevN = countPlanSlotImages(prev.plan);
  const inN = countPlanSlotImages(incoming.plan);
  const mergedN = countPlanSlotImages(merged.plan);
  if (inN > prevN && mergedN < inN) {
    return mergeEcomIpWorkflowProject(incoming, prev);
  }
  return merged;
}

function mergeIpWorkflowStepStatus(
  prevStatus: string | undefined,
  incomingStatus: string | undefined,
  slots: IpWorkflowSlotLike[],
): string {
  const next = incomingStatus ?? prevStatus ?? "pending";
  const allFilled =
    slots.length > 0 && slots.every((s) => Boolean(s.imageUrl?.trim()));
  if (next === "generating" && allFilled) return "ready";
  if (prevStatus === "generating" && incomingStatus && incomingStatus !== "generating") {
    return incomingStatus;
  }
  return next;
}

export function createIpWorkflowGenJobId(stepId: string): string {
  return `${stepId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export type IpWorkflowGenPollResult =
  | { status: "running"; progressPercent?: number; detail?: string }
  | { status: "succeeded" }
  | { status: "failed"; error: string };

/** 批量出图 Dock / 槽位扫光：API 已结束但槽位仍无图时须判失败，不能因 pending>0 永远 running */
export function evaluateIpWorkflowGenPoll(input: {
  stepStatus: string;
  slots: IpWorkflowSlotLike[];
  jobIndexes: number[];
  settled: boolean;
  generated: number;
  failures: Array<{ index: number; message: string }>;
  fetchError: string | null;
}): IpWorkflowGenPollResult {
  const total = input.jobIndexes.length;
  const done = countIpWorkflowSlotsDone(input.slots, input.jobIndexes);
  const pending = pendingIpWorkflowSlotIndexes(input.slots, input.jobIndexes);

  if (!input.settled) {
    if (pending.length === 0) {
      return { status: "succeeded" };
    }
    if (ipWorkflowServerBatchEnded(input.stepStatus)) {
      return {
        status: "running",
        progressPercent: total > 0 ? done / total : undefined,
        detail:
          done > 0
            ? `${done}/${total} 张已写入，等待收尾…`
            : `${pending.length} 张处理中…`,
      };
    }
    return {
      status: "running",
      progressPercent: total > 0 ? done / total : undefined,
      detail: `${done}/${total} 张已完成`,
    };
  }

  const failN = input.failures.length;
  const errMsg =
    input.fetchError?.trim() ||
    input.failures[0]?.message?.trim() ||
    "生成失败";

  if (input.generated === 0 && (failN > 0 || input.fetchError)) {
    return { status: "failed", error: errMsg };
  }
  if (failN > 0 && pending.length > 0) {
    return {
      status: "failed",
      error:
        input.generated > 0
          ? `${input.generated} 张成功，${failN} 张失败`
          : errMsg,
    };
  }
  if (pending.length > 0 && input.stepStatus !== "generating") {
    return {
      status: "failed",
      error: `${pending.length} 张未出图${failN > 0 ? `（${errMsg}）` : ""}`,
    };
  }
  if (pending.length > 0) {
    return { status: "failed", error: `${pending.length} 张未出图，请重试` };
  }
  return { status: "succeeded" };
}
