import type { ProjectAssetKind } from "./project-asset-types";

export const PROJECT_ASSET_PROVENANCE_SCHEMA_VERSION = 1;

export type ProjectAssetMediaKind =
  | "image"
  | "video"
  | "audio"
  | "text"
  | "mixed"
  | "unknown";

export type ProjectAssetProvenance = {
  schemaVersion: number;
  /** 主提示词（Dock / 节点 · 供后续整理提取） */
  prompt: string;
  /** 服务端入库时间 ISO */
  savedAt?: string;
  /** 客户端打开保存对话框时的时间 ISO */
  savedAtClient?: string;
  source: {
    channel: "canvas";
    edition: string;
    projectId: string | null;
    nodeId: string;
    nodeType: string;
    displayName?: string;
  };
  media: {
    kind: ProjectAssetMediaKind;
    primaryUrl?: string;
    posterUrl?: string;
  };
  /** 素材首次来源（user-upload / canvas / …） */
  firstOrigin?: string;
};

const EDITION_LABELS: Record<string, string> = {
  sbv1: "分镜视频 1.0 画布",
  pro2: "影视专业版 2.0 画布",
  pro: "Story-Pro 画布",
  standard: "画布",
};

export function mediaKindForAssetKind(kind: ProjectAssetKind): ProjectAssetMediaKind {
  if (kind === "STORYBOARD_VIDEO") return "video";
  if (kind === "AUDIO") return "audio";
  if (
    kind === "OUTLINE" ||
    kind === "STORYBOARD_SCRIPT" ||
    kind === "PROMPT" ||
    kind === "SCRIPT_PACKAGE"
  ) {
    return "text";
  }
  if (kind === "GROUP_BUNDLE") return "mixed";
  if (
    kind === "STORYBOARD_IMAGE" ||
    kind === "CHARACTER" ||
    kind === "SCENE" ||
    kind === "PROP" ||
    kind === "STYLE" ||
    kind === "PRIVATE_PORTRAIT" ||
    kind === "DIGITAL_HUMAN"
  ) {
    return "image";
  }
  return "unknown";
}

export function buildProjectAssetProvenance(args: {
  kind: ProjectAssetKind;
  prompt: string;
  edition: string;
  projectId: string | null;
  nodeId: string;
  nodeType: string;
  displayName: string;
  primaryUrl?: string;
  posterUrl?: string;
  firstOrigin?: string;
  savedAtClient?: string;
}): ProjectAssetProvenance {
  return {
    schemaVersion: PROJECT_ASSET_PROVENANCE_SCHEMA_VERSION,
    prompt: args.prompt.trim(),
    savedAtClient: args.savedAtClient ?? new Date().toISOString(),
    source: {
      channel: "canvas",
      edition: args.edition,
      projectId: args.projectId,
      nodeId: args.nodeId,
      nodeType: args.nodeType,
      displayName: args.displayName.trim() || undefined,
    },
    media: {
      kind: mediaKindForAssetKind(args.kind),
      primaryUrl: args.primaryUrl?.trim() || undefined,
      posterUrl: args.posterUrl?.trim() || undefined,
    },
    firstOrigin: args.firstOrigin?.trim() || undefined,
  };
}

export function mergeAssetProvenanceIntoPayload(
  payload: Record<string, unknown>,
  provenance: ProjectAssetProvenance,
): Record<string, unknown> {
  const next = { ...payload };
  next.assetProvenance = provenance;
  if (provenance.prompt && !str(next.prompt)) {
    next.prompt = provenance.prompt;
  }
  return next;
}

export function readProjectAssetProvenance(
  payload: Record<string, unknown> | null | undefined,
): ProjectAssetProvenance | null {
  if (!payload || typeof payload !== "object") return null;
  const raw = payload.assetProvenance;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const p = raw as ProjectAssetProvenance;
  if (p.schemaVersion !== PROJECT_ASSET_PROVENANCE_SCHEMA_VERSION) return null;
  return p;
}

export function formatProjectAssetSourceLabel(
  provenance: ProjectAssetProvenance | null,
  fallbackEdition?: string | null,
): string {
  if (!provenance?.source) {
    const ed = fallbackEdition?.trim();
    return ed ? (EDITION_LABELS[ed] ?? `画布 · ${ed}`) : "画布节点";
  }
  const ed =
    EDITION_LABELS[provenance.source.edition] ??
    `画布 · ${provenance.source.edition}`;
  const node = provenance.source.nodeType?.trim() || "节点";
  const pid = provenance.source.projectId?.trim();
  const proj = pid ? ` · 项目 ${pid.slice(0, 8)}…` : "";
  return `${ed} · ${node}${proj}`;
}

export function pickPromptFromAssetPayload(
  payload: Record<string, unknown> | null | undefined,
  description?: string,
): string {
  const prov = readProjectAssetProvenance(payload ?? {});
  if (prov?.prompt?.trim()) return prov.prompt.trim();
  if (payload && typeof payload === "object") {
    for (const key of ["prompt", "text", "anchorText"] as const) {
      const v = payload[key];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
  }
  return description?.trim() ?? "";
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}
