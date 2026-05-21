import Image from "next/image";
import Link from "next/link";

/** 顶栏「产品」下拉：AI 应用 / AI 课程 / AI 学堂 */
export function ProductMegaMenuContent() {
  return (
    <div className="flex gap-6 p-4">
      <Image
        src="/logo2.png"
        alt="智选AI"
        className="h-44 w-44 shrink-0 rounded-md object-contain bg-transparent dark:mix-blend-screen"
        width={400}
        height={400}
      />
      <div className="grid min-w-0 flex-1 grid-cols-2 gap-3">
        <Link
          href="/products/ai-apps"
          className="flex min-h-[120px] flex-col justify-center rounded-md border border-transparent p-4 hover:border-secondary hover:bg-muted"
        >
          <p className="mb-1 font-semibold leading-none text-foreground">AI 应用</p>
          <p className="line-clamp-3 text-sm text-muted-foreground">工具型产品与在线应用</p>
        </Link>
        <Link
          href="/products/ai-courses"
          className="flex min-h-[120px] flex-col justify-center rounded-md border border-transparent p-4 hover:border-secondary hover:bg-muted"
        >
          <p className="mb-1 font-semibold leading-none text-foreground">AI 课程（导购）</p>
          <p className="line-clamp-3 text-sm text-muted-foreground">商品化的课程产品介绍</p>
        </Link>
        <Link
          href="/courses"
          className="col-span-2 flex min-h-[96px] flex-col justify-center rounded-md border border-transparent p-4 hover:border-secondary hover:bg-muted"
        >
          <p className="mb-1 font-semibold leading-none text-foreground">AI 学堂</p>
          <p className="line-clamp-2 text-sm text-muted-foreground">
            课程站占位路由 · 后续接入学习与订阅权益
          </p>
        </Link>
      </div>
    </div>
  );
}
