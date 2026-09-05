import { Loader2 } from "lucide-react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const boneClass = "animate-pulse rounded-md bg-[#d0d7de]";

function Bone({ className }: { className?: string }) {
  return <div className={cn(boneClass, className)} aria-hidden />;
}

/** 概览数据加载中的可见占位（卡片结构 + 脉动块）。 */
export function AccountOverviewSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <div
        className="flex items-center gap-2 rounded-lg border border-[#d0d7de] bg-[#f6f8fa] px-3 py-2 text-sm text-[#656d76]"
        role="status"
      >
        <Loader2 className="size-4 shrink-0 animate-spin text-violet-600" aria-hidden />
        <span>正在加载账户概览…</span>
      </div>

      <section className="grid items-stretch gap-4 md:grid-cols-2">
        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                <Bone className="h-5 w-24" />
                <Bone className="h-3 w-full max-w-md" />
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <Bone className="h-9 w-28 rounded-md" />
                <Bone className="h-3 w-16" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Bone className="h-8 w-40 rounded-full" />
              <Bone className="h-8 w-32 rounded-full" />
              <Bone className="h-8 w-28 rounded-full" />
            </div>
            <Bone className="h-4 w-full max-w-lg" />
            <Bone className="h-4 w-2/3 max-w-sm" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <Bone className="h-5 w-28" />
            <Bone className="mt-2 h-3 w-48" />
          </CardHeader>
          <CardContent className="space-y-2">
            <Bone className="h-10 w-36" />
            <Bone className="h-3 w-full" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <Bone className="h-5 w-24" />
            <Bone className="mt-2 h-3 w-40" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Bone className="h-6 w-20" />
            <Bone className="h-4 w-full" />
            <Bone className="h-4 w-4/5" />
            <Bone className="h-4 w-3/5" />
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <Bone className="h-5 w-32" />
            <Bone className="mt-2 h-3 w-56" />
          </CardHeader>
          <CardContent className="space-y-2">
            <Bone className="h-10 w-full" />
            <Bone className="h-10 w-full" />
            <Bone className="h-10 w-4/5" />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
