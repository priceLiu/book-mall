import fs from "node:fs";
import path from "node:path";

export const QR_DEFAULT_AUDIO_STYLE_TAG = "ad-teaser";

export type QrAudioPromptTemplateDef = {
  id: string;
  name: string;
  content: string;
};

export type QrAudioPromptTemplateKind = "create-voiceover" | "voice-changer";

export type QrAudioPromptTemplateLibrary = Record<
  QrAudioPromptTemplateKind,
  QrAudioPromptTemplateDef[]
>;

const TEMPLATE_KINDS: QrAudioPromptTemplateKind[] = ["create-voiceover", "voice-changer"];

function templatesFilePath(): string {
  return path.join(process.cwd(), "content/quick-replica/audio-prompt-templates.json");
}

function normalizeTemplate(raw: unknown): QrAudioPromptTemplateDef | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id.trim() : "";
  const name = typeof o.name === "string" ? o.name.trim() : "";
  const content = typeof o.content === "string" ? o.content : "";
  if (!id || !name) return null;
  return { id, name, content };
}

function normalizeLibrary(raw: unknown): QrAudioPromptTemplateLibrary {
  const empty: QrAudioPromptTemplateLibrary = {
    "create-voiceover": [],
    "voice-changer": [],
  };
  if (!raw || typeof raw !== "object") return empty;
  const root = raw as Record<string, unknown>;
  for (const kind of TEMPLATE_KINDS) {
    const list = root[kind];
    if (!Array.isArray(list)) continue;
    empty[kind] = list
      .map(normalizeTemplate)
      .filter((t): t is QrAudioPromptTemplateDef => t !== null);
  }
  return empty;
}

export function readQrAudioPromptTemplates(): QrAudioPromptTemplateLibrary {
  try {
    const file = templatesFilePath();
    if (!fs.existsSync(file)) return { "create-voiceover": [], "voice-changer": [] };
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
    return normalizeLibrary(parsed);
  } catch {
    return { "create-voiceover": [], "voice-changer": [] };
  }
}

export function writeQrAudioPromptTemplates(library: QrAudioPromptTemplateLibrary): void {
  const normalized = normalizeLibrary(library);
  const file = templatesFilePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
}

export function getQrAudioPromptTemplatesForKind(
  kind: string,
): QrAudioPromptTemplateDef[] {
  const lib = readQrAudioPromptTemplates();
  if (kind === "create-voiceover" || kind === "voice-changer") {
    return lib[kind];
  }
  return [];
}
