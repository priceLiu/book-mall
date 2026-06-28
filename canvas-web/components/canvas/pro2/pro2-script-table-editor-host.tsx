"use client";

import { useCallback, useMemo, useRef } from "react";
import { useCanvasStore } from "@/lib/canvas/store";
import { resolveHubStoryboardMd } from "@/lib/canvas/story-hub-runtime";
import { extractThemeFromStorySystemPrompt } from "@/lib/canvas/story-prompts";
import { resolveStarterForHub } from "@/lib/canvas/story-workspace-resolver";
import type { StoryProScriptHubNodeData } from "@/lib/canvas/story-pro-workspace-types";
import {
  pushStoryRevision,
  type StoryTextRevision,
} from "@/lib/canvas/story-revision";
import {
  pro2HubHasCharacterTable,
  pro2HubHasOutlineContent,
  pro2HubHasSceneTable,
  pro2HubHasScriptTable,
  resolvePro2HubCharacterMd,
  resolvePro2HubSceneMd,
} from "@/lib/canvas/pro2-script-hub-helpers";
import { outlineDisplayMd } from "@/lib/canvas/story-hub-runtime";
import { Pro2ScriptHubEditorModal } from "./pro2-script-table-modal";
import {
  CREW_BULLETIN_META_ANCHOR_ID,
  hubFieldsFromGraphAnchor,
} from "@/lib/canvas/crew-bulletin-graph-anchor";

type CachedContent = {
  storyboardMd: string;
  characterMd: string;
  sceneMd: string;
  outlineMd: string;
};

/** 全局挂载 · 脚本节点全屏编辑（角色 / 分镜） */
export function Pro2ScriptTableEditorHost() {
  const editorNodeId = useCanvasStore((s) => s.pro2ScriptTableEditorNodeId);
  const editorTab = useCanvasStore((s) => s.pro2ScriptTableEditorTab);
  const setEditorTab = useCanvasStore((s) => s.setPro2ScriptTableEditorTab);
  const closeEditor = useCanvasStore((s) => s.closePro2ScriptTableEditor);
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const graphMeta = useCanvasStore((s) => s.graphMeta);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);

  const isMetaAnchor = editorNodeId === CREW_BULLETIN_META_ANCHOR_ID;

  const openSnapshotRef = useRef<{
    nodeId: string;
    content: CachedContent;
  } | null>(null);

  const node = useMemo(
    () =>
      editorNodeId && !isMetaAnchor
        ? nodes.find(
            (n) => n.id === editorNodeId && n.type === "story-pro2-script-hub",
          )
        : undefined,
    [editorNodeId, isMetaAnchor, nodes],
  );

  const metaHubFields = useMemo(() => {
    if (!isMetaAnchor || !graphMeta?.crewBulletinAnchor) return null;
    return hubFieldsFromGraphAnchor(graphMeta.crewBulletinAnchor);
  }, [isMetaAnchor, graphMeta]);

  const d = ((isMetaAnchor ? metaHubFields : node?.data) ??
    {}) as StoryProScriptHubNodeData;
  const storyboardMd = resolveHubStoryboardMd(d);
  const characterMd = resolvePro2HubCharacterMd(d);
  const sceneCtx = useMemo(
    () =>
      editorNodeId && !isMetaAnchor
        ? { nodes, edges, hubId: editorNodeId }
        : undefined,
    [editorNodeId, isMetaAnchor, nodes, edges],
  );
  const sceneMd = resolvePro2HubSceneMd(d, sceneCtx);
  const outlineMd = outlineDisplayMd(d.outlineMd ?? "");
  const hasContent =
    pro2HubHasScriptTable(d) ||
    pro2HubHasCharacterTable(d) ||
    pro2HubHasSceneTable(d, sceneCtx) ||
    pro2HubHasOutlineContent(d);

  const liveContent: CachedContent = {
    storyboardMd,
    characterMd,
    sceneMd,
    outlineMd,
  };

  if (!editorNodeId) {
    openSnapshotRef.current = null;
  } else if (
    openSnapshotRef.current?.nodeId !== editorNodeId &&
    hasContent
  ) {
    openSnapshotRef.current = { nodeId: editorNodeId, content: liveContent };
  }

  const title = useMemo(() => {
    if (isMetaAnchor) {
      const t =
        graphMeta?.crewBulletinAnchor?.linkedScriptPackageTitle?.replace(
          /^剧本包 · /,
          "",
        ) ||
        graphMeta?.crewBulletinAnchor?.crewBulletin?.scriptTitle?.trim();
      return t ? `${t} · 剧本快照` : "剧本快照";
    }
    if (!node) return "脚本";
    const starter = resolveStarterForHub(nodes, edges, node.id);
    const theme =
      extractThemeFromStorySystemPrompt(
        (starter?.data as { systemPrompt?: string })?.systemPrompt ?? "",
      ) || d.outlineMd?.split("\n")[0]?.replace(/^#+\s*/, "")?.slice(0, 32);
    return theme?.trim() ? `${theme.trim()} · 脚本` : "脚本 · 编辑";
  }, [isMetaAnchor, graphMeta, node, nodes, edges, d.outlineMd]);

  const persistOutline = useCallback(
    (md: string) => {
      if (!node) return;
      const history = pushStoryRevision(
        (d.outlineHistory as StoryTextRevision[] | undefined) ?? [],
        md.trim(),
      );
      updateNodeData(node.id, {
        outlineMd: md,
        outlineHistory: history,
      });
    },
    [node, d.outlineHistory, updateNodeData],
  );

  const persistScene = useCallback(
    (md: string) => {
      if (!node) return;
      const history = pushStoryRevision(
        (d.sceneHistory as StoryTextRevision[] | undefined) ?? [],
        md.trim(),
      );
      updateNodeData(node.id, {
        sceneMd: md,
        sceneHistory: history,
      });
    },
    [node, d.sceneHistory, updateNodeData],
  );

  const persistStoryboard = useCallback(
    (md: string) => {
      if (!node) return;
      const history = pushStoryRevision(
        (d.storyboardHistory as StoryTextRevision[] | undefined) ?? [],
        md.trim(),
      );
      updateNodeData(node.id, {
        storyboardMd: md,
        storyboardHistory: history,
      });
    },
    [node, d.storyboardHistory, updateNodeData],
  );

  const persistCharacter = useCallback(
    (md: string) => {
      if (!node) return;
      const history = pushStoryRevision(
        (d.characterHistory as StoryTextRevision[] | undefined) ?? [],
        md.trim(),
      );
      updateNodeData(node.id, {
        characterMd: md,
        characterHistory: history,
      });
    },
    [node, d.characterHistory, updateNodeData],
  );

  if (!editorNodeId) return null;

  const displayContent =
    openSnapshotRef.current?.nodeId === editorNodeId
      ? openSnapshotRef.current.content
      : hasContent
        ? liveContent
        : null;

  if (!displayContent) return null;
  if (!node && !isMetaAnchor) return null;

  if (isMetaAnchor) {
    return (
      <Pro2ScriptHubEditorModal
        open
        readOnly
        title={title}
        tab={editorTab}
        onTabChange={setEditorTab}
        outlineMd={displayContent.outlineMd}
        sceneMd={displayContent.sceneMd}
        characterMd={displayContent.characterMd}
        storyboardMd={displayContent.storyboardMd}
        onClose={closeEditor}
        onAutoSaveOutline={() => {}}
        onAutoSaveScene={() => {}}
        onAutoSaveCharacter={() => {}}
        onAutoSaveStoryboard={() => {}}
      />
    );
  }

  if (!node || !displayContent) return null;

  return (
    <Pro2ScriptHubEditorModal
      open
      title={title}
      tab={editorTab}
      onTabChange={setEditorTab}
      outlineMd={displayContent.outlineMd}
      sceneMd={displayContent.sceneMd}
      characterMd={displayContent.characterMd}
      storyboardMd={displayContent.storyboardMd}
      onClose={closeEditor}
      onAutoSaveOutline={persistOutline}
      onAutoSaveScene={persistScene}
      onAutoSaveCharacter={persistCharacter}
      onAutoSaveStoryboard={persistStoryboard}
      hubId={node.id}
      hubData={d}
    />
  );
}
