import type { QrAudioPromptTemplateDef } from "@/lib/qr-audio-catalog-client";

export function pickNextPromptTemplate(
  templates: QrAudioPromptTemplateDef[],
  currentId: string | undefined,
): QrAudioPromptTemplateDef | null {
  if (!templates.length) return null;
  if (!currentId) return templates[0] ?? null;
  const idx = templates.findIndex((t) => t.id === currentId);
  if (idx < 0) return templates[0] ?? null;
  return templates[(idx + 1) % templates.length] ?? null;
}

export function findPromptTemplate(
  templates: QrAudioPromptTemplateDef[],
  id: string | undefined,
): QrAudioPromptTemplateDef | undefined {
  if (!id) return undefined;
  return templates.find((t) => t.id === id);
}
