import { promoteEmbeddedPackFromOutline } from "./story-hub-runtime";
import { extractThemeFromStorySystemPrompt } from "./story-prompts";
import { resolveStoryProWorkflowDisplayTheme } from "./story-pro-script-assistant-workflows";
import { resolveStarterForHub } from "./story-workspace-resolver";
import type { StoryProFinalizedScriptSnapshot } from "./story-pro-workspace-types";
import type { StoryProScriptHubNodeData } from "./story-pro-workspace-types";
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";
import { formatRevisionTime } from "./story-revision";

export const STORY_PRO_FINALIZED_SCRIPT_HISTORY_MAX = 10;

/** 定稿剧本 · 合并为大纲 / 角色 / 分镜 Word 式 Markdown */
export function buildStoryProFinalizedScriptDocumentMd(
  outlineMd: string,
  characterMd: string,
  storyboardMd: string,
): string {
  const promoted = promoteEmbeddedPackFromOutline(
    outlineMd ?? "",
    characterMd ?? "",
    storyboardMd ?? "",
  );
  const parts: string[] = [];
  const outline = promoted.outlineMd.trim();
  const character = promoted.characterMd.trim();
  const storyboard = promoted.storyboardMd.trim();
  if (outline) {
    parts.push("## 一、故事大纲", "", outline);
  }
  if (character) {
    parts.push("", "## 二、角色设定", "", character);
  }
  if (storyboard) {
    parts.push("", "## 三、分镜脚本", "", storyboard);
  }
  return parts.join("\n").trim();
}

export function pushStoryProFinalizedSnapshot(
  history: StoryProFinalizedScriptSnapshot[] | undefined,
  entry: Omit<StoryProFinalizedScriptSnapshot, "version">,
): StoryProFinalizedScriptSnapshot[] {
  const prev = history ?? [];
  const nextVersion =
    prev.length > 0 ? Math.max(...prev.map((s) => s.version)) + 1 : 1;
  const next: StoryProFinalizedScriptSnapshot[] = [
    {
      ...entry,
      version: nextVersion,
    },
    ...prev,
  ];
  return next.slice(0, STORY_PRO_FINALIZED_SCRIPT_HISTORY_MAX);
}

export function formatFinalizedScriptVersionLabel(version: number): string {
  return `v${version}`;
}

export function formatFinalizedScriptTitle(theme: string): string {
  const t = theme.trim();
  return t && t !== "（在此填写你的故事主题）" ? t : "未命名主题";
}

export type StoryProFinalizedScriptView = {
  theme: string;
  version: number;
  finalizedAt: string;
  documentMd: string;
};

/** 展示用：优先历史最新一条；已定稿但无快照时从当前 hub 回落 */
export function resolveStoryProFinalizedScriptView(
  hub: StoryProScriptHubNodeData,
  starterSystemPrompt: string,
): StoryProFinalizedScriptView | null {
  const history = hub.finalizedScriptHistory ?? [];
  const latest = history[0];
  if (latest) {
    return {
      theme: latest.theme,
      version: latest.version,
      finalizedAt: latest.finalizedAt,
      documentMd: buildStoryProFinalizedScriptDocumentMd(
        latest.outlineMd,
        latest.characterMd,
        latest.storyboardMd,
      ),
    };
  }
  if (!hub.scriptFinalized) return null;
  const theme = extractThemeFromStorySystemPrompt(starterSystemPrompt ?? "");
  const documentMd = buildStoryProFinalizedScriptDocumentMd(
    hub.outlineMd ?? "",
    hub.characterMd ?? "",
    hub.storyboardMd ?? "",
  );
  if (!documentMd.trim()) return null;
  return {
    theme,
    version: 1,
    finalizedAt: hub.outlineHistory?.[0]?.savedAt ?? new Date().toISOString(),
    documentMd,
  };
}

export function formatFinalizedScriptMetaLine(
  theme: string,
  version: number,
  finalizedAt: string,
): string {
  const title = formatFinalizedScriptTitle(theme);
  const ver = formatFinalizedScriptVersionLabel(version);
  const when = formatRevisionTime(finalizedAt);
  return `${title} · ${ver} · 定稿于 ${when}`;
}

export type StoryProSavedScriptListItem = {
  id: string;
  hubId: string;
  hubLabel: string;
  snapshot: StoryProFinalizedScriptSnapshot;
  /** 在对应 hub 的 finalizedScriptHistory 中的下标（0 = 最新） */
  historyIndex: number;
};

/** 从当前画布收集全部定稿剧本（工具栏「我保存的剧本」） */
export function collectStoryProSavedScriptsFromCanvas(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
): StoryProSavedScriptListItem[] {
  const hubs = nodes.filter((n) => n.type === "story-pro-script-hub");
  const items: StoryProSavedScriptListItem[] = [];
  hubs.forEach((hub, hubIdx) => {
    const d = hub.data as unknown as StoryProScriptHubNodeData;
    const hubLabel =
      hubs.length > 1 ? `故事剧本 ${hubIdx + 1}` : "故事剧本";
    const starter = resolveStarterForHub(nodes, edges, hub.id);
    const systemPrompt =
      (starter?.data as { systemPrompt?: string } | undefined)?.systemPrompt ??
      "";
    const history = d.finalizedScriptHistory ?? [];
    if (history.length > 0) {
      history.forEach((snap, historyIndex) => {
        items.push({
          id: `${hub.id}:v${snap.version}`,
          hubId: hub.id,
          hubLabel,
          snapshot: snap,
          historyIndex,
        });
      });
      return;
    }
    if (!d.scriptFinalized) return;
    const view = resolveStoryProFinalizedScriptView(d, systemPrompt);
    if (!view) return;
    const theme =
      view.theme && view.theme !== "未命名主题" && starter
        ? view.theme
        : starter
          ? resolveStoryProWorkflowDisplayTheme(starter, hub)
          : view.theme;
    items.push({
      id: `${hub.id}:current`,
      hubId: hub.id,
      hubLabel,
      snapshot: {
        version: view.version,
        theme,
        finalizedAt: view.finalizedAt,
        outlineMd: d.outlineMd ?? "",
        characterMd: d.characterMd ?? "",
        storyboardMd: d.storyboardMd ?? "",
      },
      historyIndex: 0,
    });
  });
  return items.sort(
    (a, b) =>
      new Date(b.snapshot.finalizedAt).getTime() -
      new Date(a.snapshot.finalizedAt).getTime(),
  );
}

export function hubFinalizedScriptHistoryForItem(
  nodes: CanvasFlowNode[],
  item: StoryProSavedScriptListItem,
): StoryProFinalizedScriptSnapshot[] {
  const hub = nodes.find((n) => n.id === item.hubId);
  if (!hub) return [item.snapshot];
  const d = hub.data as unknown as StoryProScriptHubNodeData;
  const history = d.finalizedScriptHistory ?? [];
  return history.length > 0 ? history : [item.snapshot];
}
