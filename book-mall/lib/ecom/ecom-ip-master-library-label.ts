import type { EcomIpMasterProjectDto } from "@/lib/ecom/ecom-ip-master-service";
import { bumpIpMasterVersion } from "@/lib/ecom/ecom-ip-master-types";

export function nextIpMasterVersionForProject(project: EcomIpMasterProjectDto): string {
  const versions = project.meta?.templateVersions ?? [];
  const last = versions[versions.length - 1]?.version;
  return bumpIpMasterVersion(last);
}

export function buildDefaultIpMasterLibraryLabel(
  project: EcomIpMasterProjectDto,
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
