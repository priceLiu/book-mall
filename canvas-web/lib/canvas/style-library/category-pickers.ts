import type {
  StoryProColorTone,
  StoryProMainStyle,
  StoryProRenderQuality,
} from "../story-pro-workspace-types";
import type { StyleLibraryCategory } from "./catalog";

export type StyleLibraryPickerDefaults = {
  mainStyle: StoryProMainStyle;
  colorTone: StoryProColorTone;
  renderQuality: StoryProRenderQuality;
};

const CATEGORY_PICKERS: Record<StyleLibraryCategory, StyleLibraryPickerDefaults> = {
  摄影写真: {
    mainStyle: "photorealistic",
    colorTone: "soft",
    renderQuality: "oil",
  },
  电商营销: {
    mainStyle: "photorealistic",
    colorTone: "vivid",
    renderQuality: "flat",
  },
  动漫游戏: {
    mainStyle: "anime",
    colorTone: "vivid",
    renderQuality: "flat",
  },
  风格插画: {
    mainStyle: "anime",
    colorTone: "soft",
    renderQuality: "watercolor",
  },
  平面设计: {
    mainStyle: "photorealistic",
    colorTone: "high-contrast",
    renderQuality: "flat",
  },
  建筑及室内设计: {
    mainStyle: "photorealistic",
    colorTone: "soft",
    renderQuality: "oil",
  },
  创意玩法: {
    mainStyle: "cg",
    colorTone: "high-contrast",
    renderQuality: "thick-paint",
  },
  文创周边: {
    mainStyle: "anime",
    colorTone: "bright-warm",
    renderQuality: "flat",
  },
  小说推文: {
    mainStyle: "anime",
    colorTone: "soft",
    renderQuality: "thick-paint",
  },
};

export function styleLibraryPickerDefaults(
  category: string,
): StyleLibraryPickerDefaults {
  return (
    CATEGORY_PICKERS[category as StyleLibraryCategory] ?? {
      mainStyle: "photorealistic",
      colorTone: "soft",
      renderQuality: "flat",
    }
  );
}
