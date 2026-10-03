import type { IpMasterProject, IpMasterStepId } from "@/lib/ip-master-types";
import { readDraftTemplateFromProject } from "@/lib/ip-master-template-types";

export const IP_MASTER_STEPS: Array<{
  id: IpMasterStepId;
  no: number;
  label: string;
  short: string;
  summary: string;
}> = [
  { id: "input", no: 1, label: "输入", short: "入", summary: "基准图与简短描述" },
  { id: "review", no: 2, label: "校对", short: "校", summary: "结构化 IP 模板" },
  { id: "versions", no: 3, label: "版本", short: "版", summary: "保存进母版库" },
];

export function ipMasterStep(id: IpMasterStepId) {
  const hit = IP_MASTER_STEPS.find((s) => s.id === id) ?? IP_MASTER_STEPS[0]!;
  return hit;
}

export function inferIpMasterCurrentStep(project: IpMasterProject): IpMasterStepId {
  const fromMeta = project.meta?.workflow?.currentStepId;
  if (fromMeta === "extract") return "review";
  if (fromMeta && IP_MASTER_STEPS.some((s) => s.id === fromMeta)) {
    return fromMeta as IpMasterStepId;
  }
  if ((project.meta?.templateVersions?.length ?? 0) > 0) return "versions";
  const draft = project.meta?.workflow?.draftTemplate;
  if (draft && typeof draft === "object") return "review";
  if (project.meta?.workflow?.draftMarkdown?.trim()) return "review";
  return "input";
}

export function activeTemplateMarkdown(project: IpMasterProject): string {
  const versions = project.meta?.templateVersions ?? [];
  const active = project.meta?.workflow?.activeVersion;
  if (active) {
    const hit = versions.find((v) => v.version === active);
    if (hit) return hit.markdown;
  }
  return (
    project.meta?.workflow?.draftMarkdown ??
    versions[versions.length - 1]?.markdown ??
    ""
  );
}

export function activeDraftTemplate(project: IpMasterProject) {
  return readDraftTemplateFromProject(project);
}

/** @deprecated 助手已移除，保留避免旧模块编译失败 */
export const IP_MASTER_WELCOME = "";
