import type { QrTemplate } from "@/lib/qr-template-types";

const MARBLE_WORLD_ID_RE =
  /marble\.worldlabs\.ai\/world\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

export function parseWorldIdFromMarbleUrl(url: string): string | null {
  const match = url.trim().match(MARBLE_WORLD_ID_RE);
  return match?.[1] ?? null;
}

export function resolveWorldId(template: QrTemplate): string | null {
  const params = template.reference.model.params;
  const fromParams = typeof params.world_id === "string" ? params.world_id.trim() : "";
  if (fromParams) return fromParams;

  const marbleCandidates = [
    typeof params.world_marble_url === "string" ? params.world_marble_url : "",
    template.output?.url ?? "",
  ];
  for (const url of marbleCandidates) {
    const id = parseWorldIdFromMarbleUrl(url);
    if (id) return id;
  }

  if (template.id.startsWith("qr-world-api-")) {
    return template.id.slice("qr-world-api-".length);
  }
  return null;
}

export function resolveWorldMarbleUrl(template: QrTemplate): string | null {
  const params = template.reference.model.params;
  const fromParams =
    typeof params.world_marble_url === "string" ? params.world_marble_url.trim() : "";
  if (fromParams) return fromParams;

  const worldId = resolveWorldId(template);
  if (!worldId) return null;
  return `https://marble.worldlabs.ai/world/${worldId}`;
}
