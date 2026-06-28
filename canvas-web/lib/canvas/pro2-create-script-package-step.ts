import type { CanvasGraph } from "./types";
import {
  STORY_PRO2_SCRIPT_BUILTIN_TEMPLATE_ID,
  isStoryPro2BuiltinTemplateId,
} from "./project-edition";

type StarterPick =
  | { kind: "blank" }
  | { kind: "builtin"; id: string }
  | { kind: "user"; id: string };

function canvasHasScriptStudioHub(canvas: unknown): boolean {
  if (!canvas || typeof canvas !== "object") return false;
  const nodes = (canvas as CanvasGraph).nodes;
  if (!Array.isArray(nodes)) return false;
  return nodes.some(
    (n) =>
      n.type === "story-pro2-script-hub" &&
      (n.data as { scriptStudioMode?: boolean }).scriptStudioMode === true,
  );
}

/** 新建 Pro2 时是否展示「选择已发布剧本」步骤（剧本创作模板除外） */
export function pro2CreateNeedsScriptPackageStep(
  pick: StarterPick,
  userTemplates: Array<{ id: string; canvas: unknown }>,
): boolean {
  if (pick.kind === "blank") return false;
  if (pick.kind === "builtin") {
    if (pick.id === STORY_PRO2_SCRIPT_BUILTIN_TEMPLATE_ID) return false;
    return isStoryPro2BuiltinTemplateId(pick.id);
  }
  const tpl = userTemplates.find((t) => t.id === pick.id);
  if (!tpl) return false;
  return !canvasHasScriptStudioHub(tpl.canvas);
}
