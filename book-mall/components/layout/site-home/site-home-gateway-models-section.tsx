import Link from "next/link";

import { SiteHomeGatewayModelsMarquee } from "@/components/layout/site-home/site-home-gateway-models-marquee";
import { isPrismaConnectionUnavailable, logDbUnavailable } from "@/lib/db-unavailable";
import { listPublicMarketShowcaseModels } from "@/lib/gateway/market-catalog";
import { getGatewayPublicOrigin } from "@/lib/gateway/env";

export async function SiteHomeGatewayModelsSection() {
  const gatewayOrigin = getGatewayPublicOrigin();
  if (!gatewayOrigin) return null;

  let models: Awaited<ReturnType<typeof listPublicMarketShowcaseModels>> = [];
  try {
    models = await listPublicMarketShowcaseModels(16);
  } catch (e) {
    if (!isPrismaConnectionUnavailable(e)) throw e;
    logDbUnavailable("SiteHomeGatewayModelsSection", e);
    return null;
  }

  if (models.length === 0) return null;

  return (
    <section id="gateway-models" className="site-home-models py-12 sm:py-16">
      <div className="site-home-models-header mb-8 flex flex-col items-center gap-2 text-center sm:mb-10">
        <h2 className="text-lg md:text-xl">模型市场</h2>
        <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
          Gateway 已上架的视频、图像、音乐与 LLM 模型，开箱即用或通过 API 统一调用。
        </p>
        <Link
          href={`${gatewayOrigin}/dashboard/market`}
          className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
        >
          查看全部模型 →
        </Link>
      </div>
      <SiteHomeGatewayModelsMarquee models={models} gatewayOrigin={gatewayOrigin} />
    </section>
  );
}
