import type { QrTemplate } from "@/lib/qr-template-types";

export function resolveWorldId(template: QrTemplate): string | null {
  const params = template.reference.model.params;
  const fromParams = typeof params.world_id === "string" ? params.world_id.trim() : "";
  if (fromParams) return fromParams;
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

  const worldId =
    typeof params.world_id === "string"
      ? params.world_id.trim()
      : template.id.startsWith("qr-world-api-")
        ? template.id.slice("qr-world-api-".length)
        : "";
  if (!worldId) return null;
  return `https://marble.worldlabs.ai/world/${worldId}`;
}