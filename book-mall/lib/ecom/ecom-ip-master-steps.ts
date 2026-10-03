/** IP 母版 · 四步逻辑步（无批量 IMAGE 槽位） */

export const IP_MASTER_STEP_IDS = ["input", "extract", "review", "versions"] as const;

export type IpMasterStepId = (typeof IP_MASTER_STEP_IDS)[number];

export type IpMasterStepDef = {
  id: IpMasterStepId;
  no: number;
  label: string;
  short: string;
  summary: string;
  requires: IpMasterStepId[];
};

export const IP_MASTER_STEPS: IpMasterStepDef[] = [
  {
    id: "input",
    no: 1,
    label: "输入",
    short: "入",
    summary: "上传基准图 / 填写文字描述",
    requires: [],
  },
  {
    id: "extract",
    no: 2,
    label: "解析",
    short: "析",
    summary: "LLM 提取刚性锚点与柔性项",
    requires: [],
  },
  {
    id: "review",
    no: 3,
    label: "校对",
    short: "校",
    summary: "编辑 Markdown 模板草稿",
    requires: [],
  },
  {
    id: "versions",
    no: 4,
    label: "版本",
    short: "版",
    summary: "保存版本、选当前生效版",
    requires: [],
  },
];

export function getIpMasterStep(id: string): IpMasterStepDef | null {
  return IP_MASTER_STEPS.find((s) => s.id === id) ?? null;
}

export function requireIpMasterStep(id: string): IpMasterStepDef {
  const step = getIpMasterStep(id);
  if (!step) throw new Error(`未知步骤：${id}`);
  return step;
}
