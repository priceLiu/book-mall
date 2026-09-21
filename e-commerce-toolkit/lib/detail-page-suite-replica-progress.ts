import type { DetailPageSuiteProject } from "@/lib/detail-page-suite-types";

export function isReplicaDecomposeInFlight(
  meta: DetailPageSuiteProject["meta"],
): boolean {
  const s = meta?.replicaStatus;
  return s === "decomposing" || s === "polishing";
}

export function replicaDecomposeStatusCopy(
  meta: DetailPageSuiteProject["meta"],
): { title: string; detail: string } | null {
  if (!isReplicaDecomposeInFlight(meta)) return null;
  const p = meta?.replicaProgress;
  if (p?.title?.trim()) {
    return {
      title: p.title.trim(),
      detail: p.detail?.trim() ?? "",
    };
  }
  if (meta?.replicaStatus === "decomposing") {
    const step = meta?.replicaProgress?.step;
    const p = meta?.replicaProgress;
    if (step === "classify") {
      const batch =
        p?.doneModules != null && p?.totalModules != null
          ? `（批次 ${p.doneModules}/${p.totalModules}）`
          : "";
      return {
        title: "自动归类 12 模块",
        detail:
          (p?.detail?.trim() || "文本模型为每条画面建议模块…") + batch,
      };
    }
    return {
      title: "视觉清单拆解",
      detail: p?.detail?.trim() || "Vision 自上而下列出全部画面块…",
    };
  }
  return {
    title: "生成 Prompt",
    detail: "单次文本模型调用，批量润色所选模块…",
  };
}
