import type { IpMasterProject, IpMasterStepId } from "@/lib/ip-master-types";

export const IP_MASTER_STEPS: Array<{
  id: IpMasterStepId;
  no: number;
  label: string;
  short: string;
  summary: string;
}> = [
  { id: "input", no: 1, label: "输入", short: "入", summary: "基准图 / 文字描述" },
  { id: "extract", no: 2, label: "解析", short: "析", summary: "LLM 提取模板" },
  { id: "review", no: 3, label: "校对", short: "校", summary: "编辑 Markdown" },
  { id: "versions", no: 4, label: "版本", short: "版", summary: "保存与历史" },
];

export function ipMasterStep(id: IpMasterStepId) {
  const hit = IP_MASTER_STEPS.find((s) => s.id === id);
  if (!hit) throw new Error(`未知步骤：${id}`);
  return hit;
}

export function inferIpMasterCurrentStep(project: IpMasterProject): IpMasterStepId {
  const fromMeta = project.meta?.workflow?.currentStepId;
  if (fromMeta && IP_MASTER_STEPS.some((s) => s.id === fromMeta)) {
    return fromMeta;
  }
  if ((project.meta?.templateVersions?.length ?? 0) > 0) return "versions";
  if (project.meta?.workflow?.draftMarkdown?.trim()) return "review";
  if (project.chatHistory.some((m) => m.role === "assistant" && m.id !== "welcome")) {
    return "extract";
  }
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

export const IP_MASTER_WELCOME = [
  "欢迎使用 **IP 母版** 工作台。",
  "",
  "上传 1 张角色基准图和/或填写文字描述，在右侧助手发起「解析模板」；在中栏校对 Markdown 后点「保存版本」。",
  "",
  "保存后的母版可被 **手办盲盒 SOP**、**品牌VI表情包SOP** 载入固定参考图与 Prompt 约束。",
  "",
  "进度轨四步均可自由切换，无需逐步解锁。",
].join("\n");
