import type { ProjectAssetRecord } from "./project-asset-types";

/** 保存 / 编辑时的共享范围（与平台资产无关） */
export type ProjectAssetShareScope = "project" | "user" | "team";

export const PROJECT_ASSET_SHARE_SCOPE_OPTIONS: Array<{
  id: ProjectAssetShareScope;
  title: string;
  hint: string;
}> = [
  {
    id: "project",
    title: "仅本项目",
    hint: "只在当前画布侧栏「我的资产」中优先展示；其它项目不可见。",
  },
  {
    id: "user",
    title: "我的 · 全账号",
    hint:
      "跨项目复用：在任意画布的「我的资产」与 Dock @「我的」中可选（仍归你所有，不是平台官方库）。",
  },
  {
    id: "team",
    title: "团队",
    hint: "租户内成员可见可用（TEAM_PUBLIC）；仍属于你的创造，不是平台供给。",
  },
];

export function projectAssetShareScopeLabel(asset: ProjectAssetRecord): string {
  if (asset.visibility === "TEAM_PUBLIC") return "团队";
  if (asset.sourceProjectId) return "仅本项目";
  return "我的 · 全账号";
}
