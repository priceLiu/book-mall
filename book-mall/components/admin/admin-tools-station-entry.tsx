"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

/** 先落到 `/tools-open` 展示加载动画，避免新标签长时间停在 `about:blank` */
const TOOLS_STATION_NEW_TAB_HREF =
  "/tools-open?redirect=" + encodeURIComponent("/fitting-room");

export function AdminToolsStationEntry({
  toolsSsoReady,
  toolsSsoIssues,
}: {
  toolsSsoReady: boolean;
  toolsSsoIssues: string[];
}) {
  if (toolsSsoReady) {
    return (
      <div className="inline-flex shrink-0 flex-col items-start gap-0">
        <Button variant="ghost" size="sm" className="h-9 shrink-0 px-2 text-sm font-normal" asChild>
          <Link
            href={TOOLS_STATION_NEW_TAB_HREF}
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground hover:text-foreground"
            title="在新标签页打开工具站（试衣间）"
          >
            工具站
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 shrink-0 px-2 text-sm font-normal text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          title="查看缺少的配置（须在 book-mall/.env.local 填写）"
        >
          工具站（未配置）
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>工具站 SSO 未就绪</SheetTitle>
          <SheetDescription>
            须配置三项环境变量并重启主站；文档见{" "}
            <span className="font-mono text-xs">book-mall/doc/tech/tools-sso-environment.md</span>
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-3 text-sm text-muted-foreground">
          <p>
            将变量写在{" "}
            <span className="rounded bg-muted px-1 py-0.5 font-mono text-xs text-foreground">
              book-mall/.env.local
            </span>
            （不是 <span className="font-mono text-xs">tool-web</span> 目录）。
          </p>
          <p>
            <span className="font-mono text-xs">tool-web/.env.local</span> 内需相同值的{" "}
            <span className="font-mono text-xs">TOOLS_SSO_SERVER_SECRET</span>，以及{" "}
            <span className="font-mono text-xs">MAIN_SITE_ORIGIN</span>{" "}
            指向主站（本地一般为 <span className="font-mono text-xs">http://localhost:3000</span>）。
          </p>
        </div>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-foreground">
          {toolsSsoIssues.map((t, i) => (
            <li key={i} className="leading-snug">
              {t}
            </li>
          ))}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
