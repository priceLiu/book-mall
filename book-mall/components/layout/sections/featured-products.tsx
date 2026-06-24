import { SiteHomeFeaturedProductsMarquee } from "@/components/layout/site-home/site-home-featured-products-marquee";
import { buildFeaturedShowcaseCards } from "@/lib/site-home/featured-showcase";
import { prisma } from "@/lib/prisma";
import { isPrismaConnectionUnavailable, logDbUnavailable } from "@/lib/db-unavailable";

export async function FeaturedProductsSection() {
  let cards: ReturnType<typeof buildFeaturedShowcaseCards> = [];
  try {
    const products = await prisma.product.findMany({
      where: { featuredHome: true, status: "PUBLISHED", catalogUnavailable: false },
      orderBy: [{ featuredSort: "asc" }, { updatedAt: "desc" }],
      take: 12,
      include: { category: true },
    });

    const toolProducts = await prisma.product.findMany({
      where: {
        kind: "TOOL",
        status: "PUBLISHED",
        catalogUnavailable: false,
        toolNavKey: { not: null },
      },
      select: { slug: true, toolNavKey: true },
    });
    const productSlugByNavKey = new Map<string, string>();
    for (const p of toolProducts) {
      if (p.toolNavKey) productSlugByNavKey.set(p.toolNavKey, p.slug);
    }

    cards = buildFeaturedShowcaseCards(products, productSlugByNavKey);
  } catch (e) {
    if (!isPrismaConnectionUnavailable(e)) throw e;
    logDbUnavailable("FeaturedProductsSection", e);
    return null;
  }

  if (cards.length === 0) return null;

  return (
    <section id="featured-products" className="site-home-featured-products py-16 sm:py-20">
      <div className="site-home-featured-products-header site-marketing-section mb-10">
        <h2 className="text-lg md:text-xl text-center mb-2">推荐产品</h2>
        <p className="text-sm text-muted-foreground text-center max-w-xl mx-auto leading-relaxed">
        </p>
      </div>
      <SiteHomeFeaturedProductsMarquee items={cards} />
    </section>
  );
}
