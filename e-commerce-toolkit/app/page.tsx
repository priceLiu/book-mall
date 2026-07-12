import { EcomHomeAssistant } from "@/components/layout/ecom-home-assistant";
import { EcomWorkspaceLayout } from "@/components/layout/ecom-workspace-layout";
import { ProductTile } from "@/components/portal/product-tile";
import { ECOM_MODULES } from "@/lib/modules/registry";

export default function HomePage() {
  return (
    <EcomWorkspaceLayout
      assistantHeader={
        <>
          <h1 className="text-lg font-semibold text-[#1d1d1f]">电商工具箱</h1>
          <p className="text-xs text-[#6e6e73]">主图 · 详情 · 带货视频 · 品牌 VI</p>
        </>
      }
      assistant={<EcomHomeAssistant variant="home" />}
    >
      <div className="ecom-scrollbar-thin min-h-0 flex-1 overflow-y-auto">
        <section className="flex min-h-[28vh] flex-col items-center justify-center gap-6 bg-white px-4 py-12 text-center sm:min-h-[32vh] sm:px-6 sm:py-16">
          <div>
            <h2 className="text-[32px] font-semibold leading-[1.07] tracking-tight sm:text-[40px] md:text-[48px]">
              电商平台工具箱
            </h2>
            <p className="mt-4 text-base leading-snug text-[var(--ecom-muted)] sm:text-lg md:text-[22px]">
              主图、详情、带货视频与品牌传播 — 全屏创作体验
            </p>
          </div>
        </section>
        {ECOM_MODULES.map((m) => (
          <ProductTile key={m.id} module={m} />
        ))}
      </div>
    </EcomWorkspaceLayout>
  );
}
