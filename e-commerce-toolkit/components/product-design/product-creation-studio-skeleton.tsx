import { EcomWorkspaceLayout } from "@/components/layout/ecom-workspace-layout";

/** 项目数据异步加载时先渲染左右结构，避免整页空白 */
export function ProductCreationStudioSkeleton() {
  return (
    <EcomWorkspaceLayout
      progress={
        <div className="animate-pulse space-y-2 px-1">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="h-8 rounded-md bg-[#e8e8ed]" />
          ))}
        </div>
      }
      assistant={
        <div className="animate-pulse space-y-3 px-4 py-4">
          <div className="h-24 rounded-xl bg-[#e8e8ed]" />
          <div className="h-10 rounded-lg bg-[#f0f0f2]" />
        </div>
      }
    >
      <div className="animate-pulse space-y-4 p-1">
        <div className="h-32 rounded-xl bg-[#e8e8ed]" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-xl bg-[#f0f0f2]" />
          ))}
        </div>
      </div>
    </EcomWorkspaceLayout>
  );
}
