/** 故事主题 system 提示词 · 节点内 Markdown 预览用（不改变持久化原文） */
export function storyThemePromptDisplayMd(raw: string): string {
  return (raw ?? "")
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      const bracket = trimmed.match(/^【(.+)】$/);
      if (bracket) return `## 【${bracket[1]}】`;
      if (/^[一二三四五六七八九十]+、/.test(trimmed)) {
        return `### ${trimmed}`;
      }
      if (/^主题：/.test(trimmed)) return `## ${trimmed}`;
      return line;
    })
    .join("\n");
}
