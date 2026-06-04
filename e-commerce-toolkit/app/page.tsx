import { ProductTile } from "@/components/portal/product-tile";
import { ECOM_MODULES } from "@/lib/modules/registry";

export default function HomePage() {
  return (
    <main>
      <section className="flex min-h-[40vh] flex-col items-center justify-center bg-white px-6 py-24 text-center">
        <h1 className="max-w-3xl text-[56px] font-semibold leading-[1.07] tracking-tight">
          电商平台工具箱
        </h1>
        <p className="mt-4 max-w-xl text-[28px] leading-snug text-[var(--ecom-muted)]">
          主图、详情、带货视频与品牌传播 — 全屏创作体验
        </p>
      </section>
      {ECOM_MODULES.map((m) => (
        <ProductTile key={m.id} module={m} />
      ))}
    </main>
  );
}
