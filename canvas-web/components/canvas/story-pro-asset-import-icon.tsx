import { Layers } from "lucide-react";

import { PRO_ASSET_IMPORT_ICON_CLASS } from "@/lib/canvas/story-pro-node-chrome";
import { cn } from "@/lib/utils";

/** 将预览/生成图保存到项目资产库（替代槽位「入库」文案） */
export function StoryProAssetImportIcon({
  className,
}: {
  className?: string;
}) {
  return (
    <Layers className={cn(PRO_ASSET_IMPORT_ICON_CLASS, className)} aria-hidden />
  );
}
