import type { Pro2AddMenuSection } from "./pro2-add-node-menu";
import {
  JIANYING_AUTO_RENDER_LEFT_ADD_MENU,
  JIANYING_EXPORT_LEFT_ADD_MENU,
  JIANYING_EXPORT_RIGHT_ADD_MENU,
  SBV1_IMAGE_LEFT_ADD_MENU,
  SBV1_IMAGE_RIGHT_ADD_MENU,
  SBV1_GROUP_RIGHT_ADD_MENU,
  SBV1_VIDEO_ENGINE_LEFT_ADD_MENU,
  SBV1_VIDEO_ENGINE_RIGHT_ADD_MENU,
} from "./sbv1-add-node-menu";
import {
  PRO2_IMAGE_LEFT_ADD_MENU,
  PRO2_RIGHT_ADD_MENU,
  PRO2_STARTER_LEFT_ADD_MENU,
  PRO2_STYLE_ASSET_RIGHT_MENU,
} from "./pro2-add-node-menu";

export const SIDE_PLUS_BY_TYPE: Record<
  string,
  { left?: string; right?: string }
> = {
  "story-pro2-starter": { left: "plus_left", right: "text" },
  "story-pro2-script-hub": { left: "plus_left", right: "text" },
  "story-pro2-image": { left: "plus_left", right: "image" },
  "story-pro2-three-view": { left: "plus_left", right: "image" },
  "sbv1-image": { left: "plus_left", right: "image" },
  "sbv1-video-engine": { left: "plus_left", right: "out_video" },
  "jianying-export-pro2": { left: "plus_left", right: "out_render" },
  "jianying-auto-render-pro2": { left: "plus_left" },
  group: { left: "plus_left", right: "out_media" },
  "story-pro2-style-asset": { left: "plus_left", right: "style" },
};

export function sideConnectSideFromHandle(handleId: string): "left" | "right" {
  return handleId === "plus_left" ? "left" : "right";
}

/** 是否来自 LibTV 侧栏 + 的拖线（松手空白处应出菜单） */
export function isLibtvSidePlusConnectHandle(
  nodeType: string,
  handleId: string | null | undefined,
): boolean {
  if (!handleId) return false;
  const map = SIDE_PLUS_BY_TYPE[nodeType];
  if (!map) return handleId === "plus_left";
  return map.left === handleId || map.right === handleId;
}

export function resolveLibtvSideConnectMenu(
  nodeType: string,
  handleId: string,
  nodeData?: Record<string, unknown>,
): Pro2AddMenuSection[] | null {
  const side = sideConnectSideFromHandle(handleId);
  if (nodeType === "group") {
    const isSbv1 = Boolean(nodeData?.sbv1Styled);
    if (side === "left") {
      return isSbv1 ? SBV1_IMAGE_LEFT_ADD_MENU : PRO2_IMAGE_LEFT_ADD_MENU;
    }
    return isSbv1 ? SBV1_GROUP_RIGHT_ADD_MENU : PRO2_RIGHT_ADD_MENU;
  }
  switch (nodeType) {
    case "story-pro2-starter":
    case "story-pro2-script-hub":
      return side === "left"
        ? PRO2_STARTER_LEFT_ADD_MENU
        : PRO2_RIGHT_ADD_MENU;
    case "story-pro2-image":
    case "story-pro2-three-view":
      return side === "left"
        ? PRO2_IMAGE_LEFT_ADD_MENU
        : PRO2_RIGHT_ADD_MENU;
    case "story-pro2-style-asset":
      return side === "left"
        ? PRO2_IMAGE_LEFT_ADD_MENU
        : PRO2_STYLE_ASSET_RIGHT_MENU;
    case "sbv1-image":
      return side === "left"
        ? SBV1_IMAGE_LEFT_ADD_MENU
        : SBV1_IMAGE_RIGHT_ADD_MENU;
    case "sbv1-video-engine":
      return side === "left"
        ? SBV1_VIDEO_ENGINE_LEFT_ADD_MENU
        : SBV1_VIDEO_ENGINE_RIGHT_ADD_MENU;
    case "jianying-export-pro2":
      return side === "left"
        ? JIANYING_EXPORT_LEFT_ADD_MENU
        : JIANYING_EXPORT_RIGHT_ADD_MENU;
    case "jianying-auto-render-pro2":
      return side === "left" ? JIANYING_AUTO_RENDER_LEFT_ADD_MENU : null;
    default:
      return null;
  }
}
