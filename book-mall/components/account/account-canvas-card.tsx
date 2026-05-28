import Link from "next/link";
import { LayoutGrid } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LaunchCanvasAppButton } from "@/components/account/launch-canvas-app";
import { cn } from "@/lib/utils";

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-2 w-2 shrink-0 rounded-full",
        ok ? "bg-emerald-500" : "bg-muted-foreground/40",
      )}
      aria-hidden
    />
  );
}

function ChecklistRow({
  ok,
  children,
}: {
  ok: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-2 text-xs leading-relaxed">
      <span
        className={cn(
          "mt-1.5 inline-flex h-1.5 w-1.5 shrink-0 rounded-full",
          ok ? "bg-emerald-500" : "bg-muted-foreground/50",
        )}
        aria-hidden
      />
      <span className={ok ? "text-foreground" : "text-muted-foreground"}>
        {children}
      </span>
    </li>
  );
}

export function AccountCanvasCard({
  gatewayLinked,
  canLaunchCanvas,
  canvasOriginConfigured,
}: {
  gatewayLinked: boolean;
  canLaunchCanvas: boolean;
  canvasOriginConfigured: boolean;
}) {
  const ready = gatewayLinked && canLaunchCanvas;

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">AI 画布</CardTitle>
          <LayoutGrid className="h-4 w-4 text-muted-foreground" aria-hidden />
        </div>
        <CardDescription className="text-xs">
          影视专业版漫剧工作流 · 经 Gateway 调用 AI 模型
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col space-y-3">
        <div>
          <div className="flex items-center gap-2">
            <StatusDot ok={ready} />
            <p className="text-lg font-semibold leading-none">
              {ready ? "可打开" : "待配置"}
            </p>
          </div>
          {!gatewayLinked ? (
            <p className="mt-2 text-xs leading-relaxed text-amber-700 dark:text-amber-500">
              新用户请先关联 Gateway API Key，再在 Gateway 控制台绑定百炼 / DeepSeek 等厂商凭证。
            </p>
          ) : null}
        </div>
        <ul className="space-y-1 rounded-md bg-muted/40 px-3 py-2">
          <ChecklistRow ok={gatewayLinked}>
            Gateway API Key 已关联{" "}
            {!gatewayLinked ? (
              <Link href="#gateway-api-key" className="text-primary underline">
                去关联
              </Link>
            ) : null}
          </ChecklistRow>
          <ChecklistRow ok={canLaunchCanvas}>
            有效工具技术服务费（与工具站相同 SSO 准入）
            {!canLaunchCanvas ? (
              <>
                {" · "}
                <Link href="/account/tool-service-fee" className="text-primary underline">
                  去开通
                </Link>
              </>
            ) : null}
          </ChecklistRow>
          <ChecklistRow ok={canvasOriginConfigured}>
            画布站点地址已配置（CANVAS_WEB_ORIGIN）
          </ChecklistRow>
        </ul>
        <div className="mt-auto flex flex-wrap gap-2 pt-1">
          <div className="min-w-[8rem] flex-1">
            <LaunchCanvasAppButton
              enabled={ready && canvasOriginConfigured}
              variant="subscription"
              className="w-full"
              openInNewTab
              title={
                !gatewayLinked
                  ? "请先关联 Gateway API Key"
                  : !canLaunchCanvas
                    ? "请先开通工具技术服务费"
                    : undefined
              }
              helperText={
                !ready
                  ? "完成上方 checklist 后即可打开画布"
                  : undefined
              }
            />
          </div>
          {!gatewayLinked ? (
            <Button asChild variant="outline" size="sm" className="flex-1">
              <Link href="#gateway-api-key">关联 Gateway</Link>
            </Button>
          ) : (
            <Button asChild variant="outline" size="sm" className="flex-1">
              <a
                href={
                  process.env.NEXT_PUBLIC_GATEWAY_ORIGIN?.trim() ||
                  "http://localhost:3005"
                }
                target="_blank"
                rel="noopener noreferrer"
              >
                打开 Gateway
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
