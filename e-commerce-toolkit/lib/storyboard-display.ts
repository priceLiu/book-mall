/** 助手气泡展示：隐藏机器可读交付块 */
export function stripStoryboardDeliverableFence(text: string): string {
  return text
    .replace(/```storyboard-deliverable[\s\S]*?```/gi, "")
    .replace(/<!--STORYBOARD_JSON[\s\S]*?STORYBOARD_JSON-->/gi, "")
    .trim();
}
