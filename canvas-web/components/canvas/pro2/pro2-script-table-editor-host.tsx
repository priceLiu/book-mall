"use client";

import { useCallback, useMemo } from "react";
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
  pro2HubHasScriptTable,
  resolvePro2HubCharacterMd,
} from "@/lib/canvas/pro2-script-hub-helpers";
import { Pro2ScriptHubEditorModal } from "./pro2-script-table-modal";

/** 全局挂载 · 脚本节点全屏编辑（角色 / 分镜） */
export function Pro2ScriptTableEditorHost() {
  const editorNodeId = useCanvasStore((s) => s.pro2ScriptTableEditorNodeId);
  const editorTab = useCanvasStore((s) => s.pro2ScriptTableEditorTab);
  const setEditorTab = useCanvasStore((s) => s.setPro2ScriptTableEditorTab);
  const closeEditor = useCanvasStore((s) => s.closePro2ScriptTableEditor);
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);

  const node = useMemo(
    () =>
      editorNodeId
        ? nodes.find(
            (n) => n.id === editorNodeId && n.type === "story-pro2-script-hub",
          )
        : undefined,
    [editorNodeId, nodes],
  );

  const d = (node?.data ?? {}) as StoryProScriptHubNodeData;
  const storyboardMd = resolveHubStoryboardMd(d);
  const characterMd = resolvePro2HubCharacterMd(d);
  const hasContent =
    pro2HubHasScriptTable(d) || pro2HubHasCharacterTable(d);

  const title = useMemo(() => {
    if (!node) return "脚本";
    const starter = resolveStarterForHub(nodes, edges, node.id);
    const theme =
      extractThemeFromStorySystemPrompt(
        (starter?.data as { systemPrompt?: string })?.systemPrompt ?? "",
      ) || d.outlineMd?.split("\n")[0]?.replace(/^#+\s*/, "")?.slice(0, 32);
    return theme?.trim() ? `${theme.trim()} · 脚本` : "脚本 · 编辑";
  }, [node, nodes, edges, d.outlineMd]);

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

  if (!node || !hasContent) return null;

  return (
    <Pro2ScriptHubEditorModal
      open
      title={title}
      tab={editorTab}
      onTabChange={setEditorTab}
      characterMd={characterMd}
      storyboardMd={storyboardMd}
      onClose={closeEditor}
      onAutoSaveCharacter={persistCharacter}
      onAutoSaveStoryboard={persistStoryboard}
    />
  );
}
