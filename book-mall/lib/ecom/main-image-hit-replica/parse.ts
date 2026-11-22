import { randomUUID } from "crypto";

import {
  DEFAULT_MAIN_IMAGE_HIT_REPLICA_SETTINGS,
  MAIN_IMAGE_HIT_REPLICA_ASPECT_RATIOS,
  type MainImageHitReplicaAspectRatio,
  type MainImageHitReplicaOutputResolution,
  type MainImageHitReplicaCategory,
  type MainImageHitReplicaDegree,
  type MainImageHitReplicaMeta,
  type MainImageHitReplicaOutput,
  type MainImageHitReplicaReference,
  type MainImageHitReplicaSettings,
} from "./types";

const MAIN_IMAGE_HIT_REPLICA_CATEGORY_KEYS: Record<string, true> = {
  ecom_product: true,
  apparel_ecom: true,
  marketing_poster: true,
  social_media: true,
  creative_poster: true,
  other: true,
};

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

export function parseSettings(raw: unknown): MainImageHitReplicaSettings {
  const d = DEFAULT_MAIN_IMAGE_HIT_REPLICA_SETTINGS;
  const r = asRecord(raw);
  const category = r.replicaCategory;
  const degree = r.replicaDegree;
  const ratio = r.imageRatio;
  return {
    replicaCategory:
      typeof category === "string" &&
      category in MAIN_IMAGE_HIT_REPLICA_CATEGORY_KEYS
        ? (category as MainImageHitReplicaCategory)
        : d.replicaCategory,
    replicaDegree:
      degree === "style_reference" || degree === "high_fidelity"
        ? degree
        : d.replicaDegree,
    globalRequirements:
      typeof r.globalRequirements === "string" ? r.globalRequirements : d.globalRequirements,
    keepOutputStyleConsistent:
      typeof r.keepOutputStyleConsistent === "boolean"
        ? r.keepOutputStyleConsistent
        : (d.keepOutputStyleConsistent ?? true),
    language: typeof r.language === "string" ? r.language : d.language,
    imageRatio:
      typeof ratio === "string" &&
      (MAIN_IMAGE_HIT_REPLICA_ASPECT_RATIOS as readonly string[]).includes(ratio)
        ? (ratio as MainImageHitReplicaAspectRatio)
        : d.imageRatio,
    outputResolution: (() => {
      if (r.outputResolution === "1K" || r.outputResolution === "2K") {
        return r.outputResolution as MainImageHitReplicaOutputResolution;
      }
      const legacy = typeof r.imageGenSize === "string" ? r.imageGenSize : "";
      if (legacy.includes("_1K") || legacy.endsWith("1K")) return "1K";
      return d.outputResolution;
    })(),
    imageGenSize: typeof r.imageGenSize === "string" ? r.imageGenSize : d.imageGenSize,
    imageModelKey: typeof r.imageModelKey === "string" ? r.imageModelKey : d.imageModelKey,
    visionModelKey: typeof r.visionModelKey === "string" ? r.visionModelKey : d.visionModelKey,
  };
}

export function sanitizeReferences(raw: unknown): MainImageHitReplicaReference[] {
  if (!Array.isArray(raw)) return [];
  const out: MainImageHitReplicaReference[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const ossUrl = typeof r.ossUrl === "string" ? r.ossUrl.trim() : "";
    if (!ossUrl) continue;
    const role = r.role === "product" ? "product" : "reference";
    const req =
      typeof r.referenceRequirement === "string" ? r.referenceRequirement.trim() : undefined;
    out.push({
      id: typeof r.id === "string" ? r.id : randomUUID(),
      role,
      label: typeof r.label === "string" ? r.label : "",
      ossUrl,
      sortIndex: typeof r.sortIndex === "number" ? r.sortIndex : out.length,
      referenceRequirement: req || undefined,
    });
  }
  out.sort((a, b) => a.sortIndex - b.sortIndex || a.id.localeCompare(b.id));
  return out;
}

export function parseOutput(raw: unknown): MainImageHitReplicaOutput {
  const r = asRecord(raw);
  const resultsRaw = Array.isArray(r.results) ? r.results : [];
  const results = resultsRaw
    .map((row, i) => {
      if (!row || typeof row !== "object") return null;
      const x = row as Record<string, unknown>;
      const id = typeof x.id === "string" ? x.id : `r-${i + 1}`;
      const status = x.status;
      return {
        id,
        index: typeof x.index === "number" ? x.index : i + 1,
        sourceRefId: typeof x.sourceRefId === "string" ? x.sourceRefId : "",
        prompt: typeof x.prompt === "string" ? x.prompt : "",
        imageUrl: typeof x.imageUrl === "string" ? x.imageUrl : undefined,
        assetId: typeof x.assetId === "string" ? x.assetId : undefined,
        status:
          status === "generating" ||
          status === "ready" ||
          status === "failed" ||
          status === "pending"
            ? status
            : ("pending" as const),
        failMessage: typeof x.failMessage === "string" ? x.failMessage : undefined,
      };
    })
    .filter(Boolean) as MainImageHitReplicaOutput["results"];
  return { results };
}

export function parseMeta(raw: unknown): MainImageHitReplicaMeta {
  const r = asRecord(raw);
  const phase = r.phase;
  return {
    phase:
      phase === "setup" || phase === "generating" || phase === "done" ? phase : "setup",
    genStartedAt: typeof r.genStartedAt === "string" ? r.genStartedAt : undefined,
    lastBusyStaleAt: typeof r.lastBusyStaleAt === "string" ? r.lastBusyStaleAt : undefined,
  };
}