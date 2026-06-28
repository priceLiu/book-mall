import {
  getCanvasProject,
  listMyCanvasProjects,
  listProjectAssets,
} from "@/lib/canvas-api";
import { exportScriptPackageDraft } from "./export-script-package";
import type { NewProjectScriptPackageAsset } from "./pro2-new-project-script-package";
import type {
  StoryProScriptHubNodeData,
  StoryProStarterNodeData,
} from "./story-pro-workspace-types";

const MAX_PROJECT_SCAN = 24;

function assetKeyFromHub(projectId: string, hubNodeId: string): string {
  return `hub:${projectId}:${hubNodeId}`;
}

function displayNameForPublishedHub(
  hubData: StoryProScriptHubNodeData,
  projectName: string,
): string {
  const title = hubData.crewBulletin?.scriptTitle?.trim();
  if (title) return title;
  const eps = hubData.scriptStudioTotalEpisodes ?? hubData.crewBulletin?.totalEpisodes;
  if (eps) return `${projectName} · ${eps} 集`;
  return projectName || "已发布剧本";
}

/** 新建 / 关联画布 · 可选的已发布剧本（资产库 + 各 Pro2 画布内已发布 hub） */
export async function listPickableScriptPackages(
  base: string,
): Promise<NewProjectScriptPackageAsset[]> {
  const byId = new Map<string, NewProjectScriptPackageAsset>();
  const hubKeysFromAssets = new Set<string>();

  const { assets } = await listProjectAssets(base, {
    kind: "SCRIPT_PACKAGE",
    scope: "all",
    limit: 100,
  });

  for (const a of assets ?? []) {
    const payload = a.payload ?? {};
    const hubProjectId = payload.sourceHubProjectId as string | undefined;
    const hubNodeId = payload.sourceHubNodeId as string | undefined;
    if (hubProjectId && hubNodeId) {
      hubKeysFromAssets.add(assetKeyFromHub(hubProjectId, hubNodeId));
    }
    byId.set(a.id, {
      id: a.id,
      displayName: a.displayName,
      payload,
    });
  }

  const projects = (await listMyCanvasProjects(base))
    .filter((p) => p.edition === "pro2")
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )
    .slice(0, MAX_PROJECT_SCAN);

  for (const project of projects) {
    let detail;
    try {
      detail = await getCanvasProject(base, project.id);
    } catch {
      continue;
    }
    const nodes = detail.canvas?.nodes ?? [];
    const starter = nodes.find((n) => n.type === "story-pro2-starter");
    const starterData = (starter?.data ?? {}) as StoryProStarterNodeData;

    for (const node of nodes) {
      if (node.type !== "story-pro2-script-hub") continue;
      const hubData = node.data as StoryProScriptHubNodeData;
      if (hubData.scriptPublished !== true) continue;
      if (!hubData.crewBulletin?.tasks?.length) continue;

      const key = assetKeyFromHub(project.id, node.id);
      if (hubKeysFromAssets.has(key) || byId.has(key)) continue;

      const draft = exportScriptPackageDraft({
        projectId: project.id,
        edition: "pro2",
        starterId: starter?.id ?? node.id,
        starterData,
        hubId: node.id,
        hubData,
      });

      byId.set(key, {
        id: key,
        displayName: displayNameForPublishedHub(hubData, project.name),
        payload: {
          ...draft.payload,
          sourceHubProjectId: project.id,
          sourceHubNodeId: node.id,
        },
      });
    }
  }

  return [...byId.values()].sort((a, b) =>
    a.displayName.localeCompare(b.displayName, "zh-CN"),
  );
}
