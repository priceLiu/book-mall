import { EcomFeishuGuideLink } from "@/components/layout/ecom-feishu-guide-link";
import { EcomWorkspaceLayout } from "@/components/layout/ecom-workspace-layout";
import { ProductTile } from "@/components/portal/product-tile";
import { ECOM_FEISHU_GUIDE_WIKI_HUB } from "@/lib/ecom-feishu-guide-urls";
import { ECOM_MODULES } from "@/lib/modules/registry";

/** 已登录用户访问 `/` 时展示的全模块入口。 */
export function EcomHomeLoggedIn() {
  return (
    <EcomWorkspaceLayout fullWidth>
      <div className="ecom-scrollbar-thin min-h-0 flex-1 overflow-y-auto">
        <section className="flex min-h-[28vh] flex-col items-center justify-center gap-6 bg-white px-4 py-12 text-center sm:min-h-[32vh] sm:px-6 sm:py-16">
          <div>
            <h2 className="text-[32px] font-semibold leading-[1.07] tracking-tight sm:text-[40px] md:text-[48px]">
              电商平台工具箱
            </h2>
            <p className="mt-4 text-base leading-snug text-[var(--ecom-muted)] sm:text-lg md:text-[22px]">
              主图、详情、带货视频与品牌传播 — 全屏创作体验
            </p>
            <EcomFeishuGuideLink
              href={ECOM_FEISHU_GUIDE_WIKI_HUB}
              variant="button"
              label="使用指南（飞书知识库）"
              className="mt-2 border-zinc-200 text-zinc-700 hover:bg-zinc-50"
            />
          </div>
        </section>
        {ECOM_MODULES.map((m) => (
          <ProductTile key={m.id} module={m} />
        ))}
      </div>
    </EcomWorkspaceLayout>
  );
}
