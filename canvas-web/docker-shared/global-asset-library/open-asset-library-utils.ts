import type { GlobalAssetCatalogKind } from "./types";
import type { AssetLibrarySection, OpenAssetLibraryOptions } from "./unified-asset-library-types";
import type { OpenGlobalAssetLibraryOptions } from "./types";

export function globalOptionsToUnified(
  opts: OpenGlobalAssetLibraryOptions,
  app: OpenAssetLibraryOptions["app"] = "ecom",
): OpenAssetLibraryOptions {
  const defaultSection: AssetLibrarySection =
    opts.defaultSection ??
    (opts.defaultTab === "works"
      ? "shared"
      : opts.platformHub
        ? "platform"
        : "shared");
  return {
    ...opts,
    app,
    defaultSection,
    title: opts.title ?? "资产库",
  };
}

export function defaultCatalogToSection(
  kind?: GlobalAssetCatalogKind,
): AssetLibrarySection {
  if (!kind) return "shared";
  return "shared";
}

export function sectionLabel(section: AssetLibrarySection): string {
  if (section === "platform") return "平台资产";
  if (section === "project") return "本项目";
  return "我的共用";
}
