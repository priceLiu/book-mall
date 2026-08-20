/** Pro2 平台提示词模板 · 块 schema（docs/画布管理中心.md） */

export type Pro2PromptBlockSource =
  | "fixed"
  | "variable"
  | "hub_visual_style"
  | "user_override";

export type Pro2PromptBlock = {
  id: string;
  label: string;
  source: Pro2PromptBlockSource;
  content: string;
  locked?: boolean;
};

export type Pro2PromptTemplateRegistry = "SCRIPT" | "ASSET";

export type Pro2PromptTemplatePassKind =
  | "OUTLINE"
  | "CHARACTER"
  | "SCENE"
  | "STORYBOARD"
  | "CHARACTER_FOUR_VIEW"
  | "SCENE_FOUR_PANORAMA"
  | "PROP_SIX_VIEW";

export type Pro2PromptTemplateRecord = {
  id: string;
  registry: Pro2PromptTemplateRegistry;
  passKind: Pro2PromptTemplatePassKind;
  templateKey: string;
  name: string;
  description: string | null;
  version: string;
  enabled: boolean;
  blocks: Pro2PromptBlock[];
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type Pro2TemplatePackRecord = {
  id: string;
  packKey: string;
  name: string;
  enabled: boolean;
  categoryDocTitle: string | null;
  categoryDocBody: string | null;
  outlineTemplateId: string;
  characterTemplateId: string;
  sceneTemplateId: string;
  storyboardTemplateId: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  outlineTemplate?: Pro2PromptTemplateRecord;
  characterTemplate?: Pro2PromptTemplateRecord;
  sceneTemplate?: Pro2PromptTemplateRecord;
  storyboardTemplate?: Pro2PromptTemplateRecord;
};

export type Pro2HubPromptPackResolved = {
  packKey: string;
  promptOutline: string;
  promptCharacter: string;
  promptScene: string;
  promptStoryboard: string;
  categoryDocTitle?: string;
  categoryDocBody?: string;
};

export type Pro2ActiveTemplatesSnapshot = {
  packs: Pro2TemplatePackRecord[];
  scriptTemplates: Pro2PromptTemplateRecord[];
  assetTemplates: Pro2PromptTemplateRecord[];
};

export function pro2FixedBlock(
  id: string,
  label: string,
  content: string,
  locked = true,
): Pro2PromptBlock {
  return { id, label, source: "fixed", content, locked };
}

export function pro2VariableBlock(
  id: string,
  label: string,
  placeholder = "",
): Pro2PromptBlock {
  return { id, label, source: "variable", content: placeholder, locked: false };
}

export function pro2HubVisualStyleBlock(): Pro2PromptBlock {
  return {
    id: "visual_style",
    label: "视觉风格",
    source: "hub_visual_style",
    content: "[视觉风格：…]",
    locked: true,
  };
}

/** 从模板 blocks 取主 prompt 正文（剧本 Pass） */
export function resolvePro2ScriptPromptFromBlocks(blocks: Pro2PromptBlock[]): string {
  const body = blocks.find((b) => b.id === "prompt_body");
  if (body?.content.trim()) return body.content.trim();
  return blocks
    .filter((b) => b.source === "fixed" || b.source === "variable")
    .map((b) => b.content)
    .join("\n\n")
    .trim();
}

/** 从资产模板 blocks 取构图规范 fixed 块 */
export function resolvePro2AssetCompositionFromBlocks(
  blocks: Pro2PromptBlock[],
): string | undefined {
  const spec = blocks.find((b) => b.id === "composition_spec" && b.source === "fixed");
  return spec?.content.trim() || undefined;
}

export function renderPro2AssetDockPromptFromBlocks(
  blocks: Pro2PromptBlock[],
  slots: Record<string, string>,
  visualStyleTag?: string,
): string {
  const lines: string[] = [];
  for (const block of blocks) {
    if (block.source === "hub_visual_style") {
      if (visualStyleTag?.trim()) lines.push(visualStyleTag.trim());
      continue;
    }
    if (block.source === "variable") {
      const val = slots[block.id]?.trim() || block.content.trim();
      if (!val) continue;
      if (block.id === "composition_spec") {
        lines.push(val.startsWith("构图规范：") ? val : `构图规范：${val}`);
      } else {
        lines.push(`${block.label}：${val}`);
      }
      continue;
    }
    if (block.source === "fixed") {
      if (block.id === "composition_spec") {
        lines.push(`构图规范：${block.content.trim()}`);
      } else if (block.content.trim()) {
        lines.push(block.content.trim());
      }
    }
  }
  return lines.join("\n\n").trim();
}
