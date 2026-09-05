/** Vitest stub：避免 story-ref-image 链拉入 JSX MentionsTextarea */
export type MentionableItem = {
  id: string;
  label: string;
  kind?: string;
  previewUrl?: string;
};

export function parseReferencedIds(_prompt: string): string[] {
  return [];
}

export function MentionsTextarea(): null {
  return null;
}
