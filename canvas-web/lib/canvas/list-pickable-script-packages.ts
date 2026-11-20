import {
  getCanvasProject,
  listAllMyCanvasProjects,
  listProjectAssets,
} from "@/lib/canvas-api";
import { exportScriptPackageDraft } from "./export-script-package";
import type { NewProjectScriptPackageAsset } from "./pro2-new-project-script-package";
import type {
  StoryProScriptHubNodeData,
  StoryProStarterNodeData,
} from "./story-pro-workspace-types";

const MAX_PROJECT_SCAN = 24;
const HUB_SCAN_CONCURRENCY = 4;

/** 脚本 Tab · 每页条数（资产库分页，不扫画布 JSON） */
export const SCRIPT_PACKAGE_TAB_PAGE_SIZE = 12;

export async function listScriptPackageAssetPage(
  base: string,
  opts?: { cursor?: string | null; limit?: number },
): Promise<{
  items: NewProjectScriptPackageAsset[];
  hasMore: boolean;
  nextCursor: string | null;
}> {
  const limit = opts?.limit ?? SCRIPT_PACKAGE_TAB_PAGE_SIZE;
  const cursor = opts?.cursor?.trim() || undefined;
  const page = await listProjectAssets(base, {
    kind: "SCRIPT_PACKAGE",
    scope: "all",
    limit,
    cursor,
    includeLegacy: !cursor,
  });
  const items: NewProjectScriptPackageAsset[] = (page.assets ?? []).map((a) => ({
    id: a.id,
    displayName: a.displayName,
    payload: (a.payload ?? {}) as Record<string, unknown>,
  }));
  return {
    items,
    hasMore: page.hasMore,
    nextCursor: page.nextCursor,
  };
}

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

function mergeHubDiscoveries(args: {
  byId: Map<string, NewProjectScriptPackageAsset>;
  hubKeysFromAssets: Set<string>;
  project: { id: string; name: string };
  detail: Awaited<ReturnType<typeof getCanvasProject>>;
}): void {
  const nodes = args.detail.canvas?.nodes ?? [];
  const starter = nodes.find((n) => n.type === "story-pro2-starter");
  const starterData = (starter?.data ?? {}) as StoryProStarterNodeData;

  for (const node of nodes) {
    if (node.type !== "story-pro2-script-hub") continue;
    const hubData = node.data as StoryProScriptHubNodeData;
    if (hubData.scriptPublished !== true) continue;
    if (!hubData.crewBulletin?.tasks?.length) continue;

    const key = assetKeyFromHub(args.project.id, node.id);
    if (args.hubKeysFromAssets.has(key) || args.byId.has(key)) continue;

    const draft = exportScriptPackageDraft({
      projectId: args.project.id,
      edition: "pro2",
      starterId: starter?.id ?? node.id,
      starterData,
      hubId: node.id,
      hubData,
    });

    args.byId.set(key, {
      id: key,
      displayName: displayNameForPublishedHub(hubData, args.project.name),
      payload: {
        ...draft.payload,
        sourceHubProjectId: args.project.id,
        sourceHubNodeId: node.id,
      },
    });
  }
}

/** 新建 / 关联画布 · 可选剧本（资产库 + 画布内已发布 hub，hub 并行拉取） */
export async function listPickableScriptPackages(
  base: string,
): Promise<NewProjectScriptPackageAsset[]> {
  const byId = new Map<string, NewProjectScriptPackageAsset>();
  const hubKeysFromAssets = new Set<string>();

  const { assets } = await listProjectAssets(base, {
    kind: "SCRIPT_PACKAGE",
    scope: "all",
    limit: 100,
    includeLegacy: true,
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

  const projects = (await listAllMyCanvasProjects(base, { maxItems: MAX_PROJECT_SCAN * 2 }))
    .filter((p) => p.edition === "pro2")
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )
    .slice(0, MAX_PROJECT_SCAN);

  for (let i = 0; i < projects.length; i += HUB_SCAN_CONCURRENCY) {
    const chunk = projects.slice(i, i + HUB_SCAN_CONCURRENCY);
    const details = await Promise.all(
      chunk.map((project) =>
        getCanvasProject(base, project.id).catch(() => null),
      ),
    );
    for (let j = 0; j < chunk.length; j++) {
      const detail = details[j];
      const project = chunk[j];
      if (!detail || !project) continue;
      mergeHubDiscoveries({
        byId,
        hubKeysFromAssets,
        project,
        detail,
      });
    }
  }

  return [...byId.values()].sort((a, b) =>
    a.displayName.localeCompare(b.displayName, "zh-CN"),
  );
}
