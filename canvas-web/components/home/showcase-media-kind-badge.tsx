import { Film, ImageIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type Props = {
  kind: "image" | "video";
  className?: string;
};

/** 成片 / 分镜图角标（视频作品与各列表封面共用） */
export function ShowcaseMediaKindBadge({ kind, className }: Props) {
  return (
    <span
      className={cn(
        "pointer-events-none absolute left-2 top-2 z-10 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[10px] text-white/90 backdrop-blur-sm",
        className,
      )}
    >
      {kind === "video" ? (
        <Film className="size-3" aria-hidden />
      ) : (
        <ImageIcon className="size-3" aria-hidden />
      )}
      {kind === "video" ? "成片" : "分镜图"}
    </span>
  );
}
