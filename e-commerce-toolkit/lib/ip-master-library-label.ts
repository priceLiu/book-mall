import type { IpMasterProject } from "@/lib/ip-master-types";

export function bumpIpMasterVersion(prev: string | undefined): string {
  const raw = (prev ?? "V0.0").replace(/^V/i, "");
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n)) return "V1.0";
  const next = Math.round((n + 0.1) * 10) / 10;
  return `V${next.toFixed(1)}`;
}

export function nextIpMasterVersionForProject(project: IpMasterProject): string {
  const versions = project.meta?.templateVersions ?? [];
  const last = versions[versions.length - 1]?.version;
  return bumpIpMasterVersion(last);
}

/** 保存进母版库时的系统默认显示名 */
export function buildDefaultIpMasterLibraryLabel(
  project: IpMasterProject,
  ipNameFromDraft: string,
): string {
  const base =
    ipNameFromDraft.trim() ||
    project.title?.trim() ||
    "IP母版";
  const version = nextIpMasterVersionForProject(project);
  return `${base} · ${version}`;
}

export function sanitizeIpMasterLibraryLabel(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").slice(0, 120) || "IP母版";
}
