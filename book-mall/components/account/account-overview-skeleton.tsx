import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function Bone({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted/70", className)}
      aria-hidden
    />
  );
}

/** 概览页数据加载前的占位（壳层已可见）。 */
export function AccountOverviewSkeleton() {
  return (
    <section className="grid items-stretch gap-4 md:grid-cols-2" aria-busy="true">
      <Card className="md:col-span-2">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <Bone className="h-5 w-24" />
              <Bone className="mt-2 h-3 w-64" />
            </div>
            <Bone className="h-9 w-28 shrink-0 rounded-md" />
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Bone className="h-8 w-40 rounded-full" />
          <Bone className="h-8 w-32 rounded-full" />
          <Bone className="h-8 w-28 rounded-full" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <Bone className="h-5 w-28" />
          <Bone className="mt-2 h-3 w-48" />
        </CardHeader>
        <CardContent>
          <Bone className="h-10 w-36" />
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
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader className="pb-3">
          <Bone className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <Bone className="h-32 w-full" />
        </CardContent>
      </Card>
    </section>
  );
}
