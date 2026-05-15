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
            本地在{" "}
            <span className="font-mono text-xs">book-mall/.env.local</span> 配置；生产环境在云服务（如云托管）
            <strong className="font-normal text-foreground">主站服务的环境变量</strong>
            中配置，保存后需重新发布。说明见{" "}
            <span className="font-mono text-xs">book-mall/doc/tech/tools-sso-environment.md</span>
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-3 text-sm text-muted-foreground">
          <p>
            必填：<span className="font-mono text-xs">TOOLS_PUBLIC_ORIGIN</span>（与用户浏览器打开工具站的
            URL 一致）、
            <span className="font-mono text-xs">TOOLS_SSO_SERVER_SECRET</span>、
            <span className="font-mono text-xs">TOOLS_SSO_JWT_SECRET</span>（与工具站相同）。
            生产域名建议 <span className="font-mono text-xs">https://book.ai-code8.com</span> /{" "}
            <span className="font-mono text-xs">https://tool.ai-code8.com</span>；
            若控制台仍保留默认 <span className="font-mono text-xs">*.sh.run.tcloudbase.com</span>，可为主站增设{" "}
            <span className="font-mono text-xs">TOOLS_SSO_ISSUE_ORIGIN</span> 指向实际工具站 origin。
          </p>
          <p>
            本地开发可将变量写在{" "}
            <span className="rounded bg-muted px-1 py-0.5 font-mono text-xs text-foreground">
              book-mall/.env.local
            </span>
            （勿提交仓库）。
          </p>
          <p>
            <span className="font-mono text-xs">tool-web</span> 内需相同密钥，且{" "}
            <span className="font-mono text-xs">TOOLS_PUBLIC_ORIGIN</span> /{" "}
            <span className="font-mono text-xs">MAIN_SITE_ORIGIN</span> 与线上访问方式一致。
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
