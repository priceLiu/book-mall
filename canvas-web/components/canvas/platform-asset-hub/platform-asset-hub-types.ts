export type PlatformAssetHubSection =
  | "catalog"
  | "garment"
  | "scene"
  | "prop"
  | "reference"
  | "storyboard-image"
  | "audio"
  | "storyboard-video"
  | "style"
  | "camera-shot"
  | "digital-human";

export type OpenPlatformAssetHubOptions = {
  section?: PlatformAssetHubSection;
  /** 与 GlobalAssetLibrary pick 一致 */
  pickMode?: boolean;
  onPickCatalog?: import("@/docker-shared/global-asset-library/types").OpenGlobalAssetLibraryOptions["onPick"];
  title?: string;
};
