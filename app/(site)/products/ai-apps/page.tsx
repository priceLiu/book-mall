import Link from "next/link";
import { PublishedProductList } from "@/components/products/published-product-list";

export const metadata = {
  title: "AI 应用",
  description: "工具型产品与在线 AI 应用，浏览定价与能力说明。",
};

export default function AiAppsPage() {
  return (
    <main className="container max-w-screen-xl mx-auto px-4 pb-16 pt-6 sm:pt-8 md:pt-10">
      <nav className="text-sm text-muted-foreground mb-6">
        <Link href="/" className="hover:text-foreground">
          首页
        </Link>
        <span className="mx-2">/</span>
        <Link href="/products" className="hover:text-foreground">
          全部产品
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">AI 应用</span>
      </nav>

      <header className="mb-10 max-w-2xl">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">AI 应用</h1>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          工具型产品：查看简介、档位、价格与权限/计费说明；点击进入详情了解大模型调用与使用边界。
        </p>
      </header>

      <PublishedProductList kind="TOOL" emptyMessage="暂无已上架的 AI 应用，敬请期待。" />

      <p className="mt-10 text-sm text-muted-foreground">
        想找系统课？前往{" "}
        <Link href="/products/ai-courses" className="text-primary underline-offset-4 hover:underline">
          AI 课程
        </Link>
        ；或{" "}
        <Link href="/products" className="text-primary underline-offset-4 hover:underline">
          查看全部产品
        </Link>
        。
      </p>
    </main>
  );
}
