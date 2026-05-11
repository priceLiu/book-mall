import Link from "next/link";
import { PublishedProductList } from "@/components/products/published-product-list";

export const metadata = {
  title: "AI 课程",
  description: "知识型课程与学习产品，含基础/进阶档位与内容介绍。",
};

export default function AiCoursesPage() {
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
        <span className="text-foreground">AI 课程</span>
      </nav>

      <header className="mb-10 max-w-2xl">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">AI 课程</h1>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          知识型产品：展示课程分类、概要、档位与价格；详情页可查看完整说明与课程大纲类内容。
        </p>
      </header>

      <PublishedProductList kind="KNOWLEDGE" emptyMessage="暂无已上架的 AI 课程，敬请期待。" />

      <p className="mt-10 text-sm text-muted-foreground">
        需要在线工具？前往{" "}
        <Link href="/products/ai-apps" className="text-primary underline-offset-4 hover:underline">
          AI 应用
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
