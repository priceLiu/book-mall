import type { Prisma } from "@prisma/client";

import type {
  EcomStylePreset,
  EcomStylePresetKind,
  EcomStylePresetVertical,
} from "./types";

function parseVerticals(raw: unknown): EcomStylePresetVertical[] {
  if (!Array.isArray(raw)) return [];
  const allowed = new Set<EcomStylePresetVertical>([
    "fashion_apparel",
    "bags",
    "digital_3c",
    "footwear",
    "jewelry",
    "outdoor_gear",
    "loungewear",
    "kitchenware",
    "baby_maternal",
    "generic",
  ]);
  return raw.filter((x): x is EcomStylePresetVertical => typeof x === "string" && allowed.has(x as EcomStylePresetVertical));
}

function parsePalette(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const palette = raw.filter((x): x is string => typeof x === "string" && x.length > 0);
  return palette.length > 0 ? palette : undefined;
}

export type EcomStylePresetRow = {
  id: string;
  kind: string;
  verticals: unknown;
  title: string;
  subtitle: string | null;
  layoutPrompt: string | null;
  visualPrompt: string | null;
  palette: unknown;
  thumbUrl: string | null;
  referenceUrl: string | null;
  sortOrder: number;
  enabled: boolean;
  deletedAt: Date | null;
  updatedAt: Date;
};

export function mapStylePresetRow(
  row: EcomStylePresetRow,
  media?: { thumbUrl?: string },
): EcomStylePreset {
  const kind: EcomStylePresetKind =
    row.kind === "trending_visual" ? "trending_visual" : "sellpoint_layout";
  return {
    id: row.id,
    kind,
    verticals: parseVerticals(row.verticals),
    title: row.title,
    subtitle: row.subtitle ?? undefined,
    palette: parsePalette(row.palette),
    thumbUrl: media?.thumbUrl ?? row.thumbUrl ?? undefined,
    layoutPrompt: row.layoutPrompt ?? undefined,
    visualPrompt: row.visualPrompt ?? undefined,
    sortOrder: row.sortOrder,
  };
}

export function verticalsToJson(
  verticals: EcomStylePresetVertical[],
): Prisma.InputJsonValue {
  return verticals;
}
