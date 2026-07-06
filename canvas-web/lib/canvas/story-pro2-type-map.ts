/** story-pro2 节点 type → runner / 守卫用的 pro 等价 type */
export function storyPro2ToProRunnerType(type: string): string {
  if (type.startsWith("story-pro2-")) {
    return type.replace("story-pro2-", "story-pro-");
  }
  if (type === "jianying-export-pro2") return "jianying-export-pro";
  if (type === "jianying-auto-render-pro2") return "jianying-export-pro";
  return type;
}

export function isStoryProFamilyNode(type: string): boolean {
  return (
    type.startsWith("story-pro2-") ||
    type === "jianying-export-pro2" ||
    type === "jianying-auto-render-pro2" ||
    (type.startsWith("story-pro-") && !type.startsWith("story-pro2-")) ||
    type === "jianying-export-pro"
  );
}

export function isStoryPro2FamilyNode(type: string): boolean {
  return (
    type.startsWith("story-pro2-") ||
    type === "jianying-export-pro2" ||
    type === "jianying-auto-render-pro2"
  );
}
