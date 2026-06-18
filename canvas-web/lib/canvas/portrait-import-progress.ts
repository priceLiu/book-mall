export type PortraitImportStepStatus =
  | "pending"
  | "running"
  | "success"
  | "error"
  | "skipped";

export type PortraitImportStep = {
  status: PortraitImportStepStatus;
  detail?: string;
};

export type PortraitImportProgressState = {
  open: boolean;
  /** 是否可关闭（进行中时为 false） */
  canClose: boolean;
  volcengine: PortraitImportStep;
  projectAsset: PortraitImportStep;
};

const INITIAL: PortraitImportProgressState = {
  open: false,
  canClose: false,
  volcengine: { status: "pending" },
  projectAsset: { status: "pending" },
};

let state: PortraitImportProgressState = INITIAL;
const listeners = new Set<(s: PortraitImportProgressState) => void>();

function emit(next: PortraitImportProgressState) {
  state = next;
  for (const fn of listeners) fn(state);
}

export function subscribePortraitImportProgress(
  fn: (s: PortraitImportProgressState) => void,
): () => void {
  listeners.add(fn);
  fn(state);
  return () => listeners.delete(fn);
}

export function getPortraitImportProgress(): PortraitImportProgressState {
  return state;
}

export function openPortraitImportProgress(): void {
  emit({
    open: true,
    canClose: false,
    volcengine: { status: "running", detail: "提交至火山私域人像库…" },
    projectAsset: { status: "pending" },
  });
}

export function patchPortraitImportProgress(
  patch: Partial<PortraitImportProgressState> & {
    volcengine?: Partial<PortraitImportStep>;
    projectAsset?: Partial<PortraitImportStep>;
  },
): void {
  emit({
    ...state,
    ...patch,
    volcengine: { ...state.volcengine, ...patch.volcengine },
    projectAsset: { ...state.projectAsset, ...patch.projectAsset },
  });
}

export function closePortraitImportProgress(): void {
  emit(INITIAL);
}

/** 0–100，两步各 50% */
export function portraitImportProgressPercent(
  s: PortraitImportProgressState,
): number {
  const stepPct = (step: PortraitImportStep, weight: number): number => {
    switch (step.status) {
      case "success":
      case "skipped":
        return weight;
      case "running":
        return weight * 0.65;
      case "error":
        return weight * 0.65;
      default:
        return 0;
    }
  };
  return Math.round(stepPct(s.volcengine, 50) + stepPct(s.projectAsset, 50));
}

export function portraitImportProgressTitle(
  s: PortraitImportProgressState,
): string {
  if (!s.canClose) return "私域人像入库";
  const v = s.volcengine.status;
  const p = s.projectAsset.status;
  if (v === "error") return "入库失败";
  if (v === "success" && p === "success") return "入库完成";
  if (v === "success" && p === "error") return "步骤 2 未完成";
  if (v === "success" && (p === "skipped" || p === "pending")) return "入库部分完成";
  return "私域人像入库";
}

export function formatPortraitProjectAssetError(raw: unknown): string {
  const msg = raw instanceof Error ? raw.message : String(raw);
  if (/PRIVATE_PORTRAIT|ProjectAssetKind/i.test(msg)) {
    return `${msg}\n\n提示：数据库可能尚未添加「私域人像库」资产类型，请在 book-mall 目录执行 pnpm db:deploy 后重试。`;
  }
  if (/Invalid `prisma\.projectAsset/i.test(msg)) {
    return `${msg}\n\n提示：项目资产服务异常，请确认 book-mall 已部署最新代码并完成数据库迁移。`;
  }
  return msg;
}
