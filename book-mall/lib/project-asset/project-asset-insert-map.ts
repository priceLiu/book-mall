import type { ProjectAssetKind } from "@prisma/client";

import { mergeAssetNodeSnapshot } from "./project-asset-insert-snapshot";
import type { InsertMapInput, InsertMapResult } from "./project-asset-types";
import type { ProjectAssetRecord } from "./project-asset-types";

const PRO2_IMAGE_SIZE = { width: 280, height: 360 };
const SBV1_VIDEO_SIZE = { width: 420, height: 280 };

export function mapProjectAssetToCanvasInsert(
  asset: ProjectAssetRecord,
  input: InsertMapInput,
): InsertMapResult | InsertMapResult[] {
  const edition = input.edition;
  const payload = asset.payload;

  switch (asset.kind) {
    case "STORYBOARD_IMAGE":
      if (edition === "sbv1") {
        return mergeAssetNodeSnapshot(
          asset,
          "sbv1-image",
          {
            label: asset.displayName,
            dockInput: String(payload.prompt ?? ""),
          },
          PRO2_IMAGE_SIZE,
        );
      }
      if (edition === "pro2") {
        return mergeAssetNodeSnapshot(
          asset,
          "story-pro2-image",
          {
            label: asset.displayName,
            dockInput: String(payload.prompt ?? ""),
            pro2MediaRole: payload.role ?? "frame",
          },
          PRO2_IMAGE_SIZE,
        );
      }
      return mergeAssetNodeSnapshot(asset, "story-pro-frame", {
        rowKey: asset.displayName,
      });

    case "CHARACTER":
      if (edition === "pro2") {
        return mergeAssetNodeSnapshot(
          asset,
          "story-pro2-three-view",
          {
            label: asset.displayName,
            characterKey: String(payload.characterKey ?? asset.displayName),
            dockInput: String(payload.prompt ?? ""),
          },
          PRO2_IMAGE_SIZE,
        );
      }
      return mergeAssetNodeSnapshot(asset, "story-pro-character", {
        characterKey: String(payload.characterKey ?? asset.displayName),
      });

    case "STORYBOARD_VIDEO":
      if (edition === "sbv1") {
        return mergeAssetNodeSnapshot(
          asset,
          "sbv1-video-engine",
          {
            label: asset.displayName,
            dockInput: String(payload.prompt ?? ""),
          },
          SBV1_VIDEO_SIZE,
        );
      }
      return mergeAssetNodeSnapshot(asset, "story-pro-video", {
        rowKey: asset.displayName,
      });

    case "OUTLINE":
      if (edition === "pro2") {
        return mergeAssetNodeSnapshot(asset, "story-pro2-starter", {
          label: asset.displayName,
          generatedOutlineMd: String(payload.markdown ?? asset.description),
        });
      }
      return mergeAssetNodeSnapshot(asset, "story-pro-starter", {
        uploadedScriptMd: String(payload.markdown ?? ""),
      });

    case "STORYBOARD_SCRIPT":
      if (edition === "pro2") {
        return mergeAssetNodeSnapshot(asset, "story-pro2-script-hub", {
          label: asset.displayName,
          outlineMd: String(payload.markdown ?? asset.description),
        });
      }
      return mergeAssetNodeSnapshot(asset, "story-pro-script-hub", {
        outlineMd: String(payload.markdown ?? ""),
      });

    case "STYLE":
      if (edition === "pro2") {
        return mergeAssetNodeSnapshot(asset, "story-pro2-style-asset", {
          label: asset.displayName,
          styleAnchorZh: String(payload.anchorText ?? asset.description),
          refImageUrls: payload.refUrls ?? asset.refs.map((r) => r.mediaUrl),
        });
      }
      return mergeAssetNodeSnapshot(asset, "story-pro-style", {
        styleAnchorZh: String(payload.anchorText ?? ""),
      });

    case "PROMPT":
      return mergeAssetNodeSnapshot(
        asset,
        edition === "pro2" ? "story-pro2-image" : "sbv1-image",
        {
          label: asset.displayName,
          dockInput: String(payload.text ?? asset.description),
        },
        edition === "pro2" ? PRO2_IMAGE_SIZE : PRO2_IMAGE_SIZE,
      );

    case "GROUP_BUNDLE": {
      const layout = payload.layout as
        | { nodes?: unknown[]; edges?: unknown[] }
        | undefined;
      if (layout?.nodes?.length) {
        const editionHint = String(payload.edition ?? asset.sourceEdition ?? "");
        return mergeAssetNodeSnapshot(asset, "group", {
          label: asset.displayName,
          bundleLayout: layout,
          pro2Kind: payload.pro2Kind,
          pro2Styled: editionHint === "pro2" || Boolean(payload.pro2Kind),
          sbv1Styled: editionHint === "sbv1",
        });
      }
      return mergeAssetNodeSnapshot(
        asset,
        edition === "sbv1" ? "sbv1-image" : "story-pro2-image",
        { label: asset.displayName },
        PRO2_IMAGE_SIZE,
      );
    }

    case "DIGITAL_HUMAN":
      return mergeAssetNodeSnapshot(
        asset,
        edition === "pro2" ? "story-pro2-image" : "sbv1-image",
        {
          label: asset.displayName,
          pro2MediaRole: "digital-human",
        },
        PRO2_IMAGE_SIZE,
      );

    case "PRIVATE_PORTRAIT": {
      const nodeType = edition === "sbv1" ? "sbv1-image" : "story-pro2-image";
      return mergeAssetNodeSnapshot(
        asset,
        nodeType,
        {
          label: asset.displayName,
          portraitKind: payload.portraitKind,
          portraitAssetId: String(payload.portraitAssetId ?? ""),
          portraitAssetUri: String(payload.portraitAssetUri ?? ""),
          portraitStatus: payload.portraitStatus ?? "active",
          portraitGroupId: payload.portraitGroupId,
          ossUrl: String(payload.sourceOssUrl ?? ""),
        },
        PRO2_IMAGE_SIZE,
      );
    }

    case "AUDIO":
    case "SCENE":
    case "PROP":
    default:
      return mergeAssetNodeSnapshot(
        asset,
        edition === "pro2" ? "story-pro2-image" : "story-pro-scene",
        { label: asset.displayName },
        edition === "pro2" ? PRO2_IMAGE_SIZE : undefined,
      );
  }
}

export function defaultKindForNodeType(nodeType: string): ProjectAssetKind {
  const map: Record<string, ProjectAssetKind> = {
    "story-pro2-starter": "OUTLINE",
    "story-pro-starter": "OUTLINE",
    "story-pro2-script-hub": "STORYBOARD_SCRIPT",
    "story-pro-script-hub": "STORYBOARD_SCRIPT",
    "story-pro2-image": "STORYBOARD_IMAGE",
    "story-pro2-three-view": "CHARACTER",
    "sbv1-image": "STORYBOARD_IMAGE",
    "sbv1-video-engine": "STORYBOARD_VIDEO",
    "story-pro2-style-asset": "STYLE",
    "story-pro-style": "STYLE",
    "story-pro-character": "CHARACTER",
    "story-pro-scene": "SCENE",
    "story-pro-frame": "STORYBOARD_IMAGE",
    "story-pro-video": "STORYBOARD_VIDEO",
    group: "GROUP_BUNDLE",
  };
  return map[nodeType] ?? "STORYBOARD_IMAGE";
}
