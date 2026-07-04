import { readFileSync } from "node:fs";
import { join } from "node:path";

type BuiltinWorldAssetEntry = {
  worldId: string;
  title: string;
  worldMarbleUrl: string | null;
  spzUrlMap: Record<string, string>;
  splatUrls: string[];
  thumbnailUrl: string | null;
  panoUrl: string | null;
  colliderMeshUrl: string | null;
};

type BuiltinWorldAssetMap = Map<string, BuiltinWorldAssetEntry>;

function normalizeUrl(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseSplatUrls(input: unknown): string[] {
  if (!input || typeof input !== "object") return [];
  const out: string[] = [];
  for (const v of Object.values(input as Record<string, unknown>)) {
    const u = normalizeUrl(v);
    if (u) out.push(u);
  }
  return [...new Set(out)];
}

function parseSplatUrlMap(input: unknown): Record<string, string> {
  if (!input || typeof input !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    const u = normalizeUrl(v);
    if (!u) continue;
    out[k] = u;
  }
  return out;
}

function readBuiltinWorldAssetMap(): BuiltinWorldAssetMap {
  const file = join(process.cwd(), "content", "quick-replica", "builtin-world-gallery.json");
  const raw = readFileSync(file, "utf8");
  const arr = JSON.parse(raw) as Array<Record<string, unknown>>;
  const map: BuiltinWorldAssetMap = new Map();

  for (const row of arr) {
    const reference = row.reference as Record<string, unknown> | undefined;
    const model = reference?.model as Record<string, unknown> | undefined;
    const params = model?.params as Record<string, unknown> | undefined;
    const worldId = normalizeUrl(params?.world_id);
    if (!worldId) continue;

    const title = normalizeUrl(row.title) ?? "Marble World";
    const worldMarbleUrl = normalizeUrl(params?.world_marble_url);
    const thumbnailUrl =
      normalizeUrl(row.thumbnailUrl) ??
      normalizeUrl(params?.thumbnail_source_url);
    const panoUrl = normalizeUrl(params?.pano_url);
    const colliderMeshUrl = normalizeUrl(params?.collider_mesh_url);
    const spzUrlMap = parseSplatUrlMap(params?.splat_urls);
    const splatUrls = parseSplatUrls(spzUrlMap);

    map.set(worldId, {
      worldId,
      title,
      worldMarbleUrl,
      spzUrlMap,
      splatUrls,
      thumbnailUrl,
      panoUrl,
      colliderMeshUrl,
    });
  }

  return map;
}

export function findBuiltinWorldAssetEntry(worldId: string): BuiltinWorldAssetEntry | null {
  try {
    return readBuiltinWorldAssetMap().get(worldId.trim()) ?? null;
  } catch {
    return null;
  }
}

