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

/** 邀请明细页加载占位。 */
export function ReferralPanelSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <Card>
        <CardHeader className="pb-3">
          <Bone className="h-5 w-32" />
          <Bone className="mt-2 h-3 w-full max-w-md" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Bone className="h-10 w-48" />
          <Bone className="h-10 w-full" />
          <Bone className="h-40 w-40 rounded-lg" />
        </CardContent>
      </Card>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Bone className="h-3 w-16" />
              <Bone className="mt-2 h-6 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Bone className="h-5 w-24" />
        </CardHeader>
        <CardContent>
          <Bone className="h-32 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}
