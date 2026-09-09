import type { VtonTryonResult, VtonTryonResultVersion } from "@/lib/vton-types";

export function normalizeVtonTryonResultVersions(result: VtonTryonResult): VtonTryonResultVersion[] {
  if (Array.isArray(result.versions) && result.versions.length > 0) {
    return result.versions.filter((v) => v.ossUrl?.trim());
  }
  if (result.status === "success" && result.ossUrl?.trim()) {
    return [
      {
        ossUrl: result.ossUrl.trim(),
        createdAt: result.createdAt,
        resultId: result.id,
      },
    ];
  }
  return [];
}

export function resolveVtonTryonActiveVersionIndex(
  result: VtonTryonResult,
  versions: VtonTryonResultVersion[],
): number {
  if (versions.length < 1) return 0;
  const idx = result.activeVersionIndex;
  if (typeof idx === "number" && idx >= 0 && idx < versions.length) return idx;
  return versions.length - 1;
}

export function resolveVtonTryonActiveOssUrl(result: VtonTryonResult): string | null {
  const versions = normalizeVtonTryonResultVersions(result);
  if (versions.length < 1) return result.ossUrl?.trim() ?? null;
  const idx = resolveVtonTryonActiveVersionIndex(result, versions);
  return versions[idx]?.ossUrl?.trim() ?? null;
}
