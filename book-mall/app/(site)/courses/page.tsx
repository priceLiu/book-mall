import Link from "next/link";
import Image from "next/image";
import { listPublishedKnowledgeProducts } from "@/lib/courses-published";
import { parseCourseContentJson } from "@/lib/course-content-json";
import { Badge } from "@/components/ui/badge";

export const metadata = {
  title: "AI 学堂 — AI Mall",
  description: "会员课程学习入口；知识与订阅权益联动。",
};

export const dynamic = "force-dynamic";

const tierZh: Record<string, string> = {
  BASIC: "入门",
  ADVANCED: "进阶",
};

export default async function CoursesIndexPage() {
  const courses = await listPublishedKnowledgeProducts();

  return (
    <main className="pb-16 pt-8 md:pt-12">
      <div className="mx-auto max-w-3xl px-4 space-y-8">
        <header className="space-y-2">
          <Badge variant="outline">课程 · 主站内嵌</Badge>
          <h1 className="text-3xl font-bold tracking-tight">AI 学堂</h1>
          <p className="text-muted-foreground leading-relaxed">
            课程数据来自后台 <strong>产品管理</strong> 中「知识型 · 已上架」条目；学习页需登录且具备{" "}
            <strong>有效订阅</strong>（管理员可直通）。
          </p>
          <p className="text-sm text-muted-foreground">
            也可从顶栏 <strong>产品 → AI 学堂</strong> 进入本站。
          </p>
        </header>

        {courses.length === 0 ? (
          <p className="text-sm text-muted-foreground border border-dashed rounded-lg p-6">
            暂无已上架课程。请在后台「产品管理」新建<strong>知识型</strong>产品并上架，或执行{" "}
            <code className="font-mono text-xs">pnpm db:seed</code> 写入示例数据。
          </p>
        ) : (
          <ul className="space-y-4">
            {courses.map((c) => {
              const parsed = parseCourseContentJson(c.courseContent);
              const level =
                parsed?.level ??
                (c.tier === "ADVANCED" ? tierZh.ADVANCED : tierZh.BASIC);
              return (
                <li key={c.slug}>
                  <Link
                    href={`/courses/${c.slug}`}
                    className="flex gap-4 rounded-xl border border-border bg-card p-4 shadow-sm transition hover:border-primary/40 hover:bg-muted/30 sm:p-5"
                  >
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md bg-muted sm:h-24 sm:w-24">
                      <Image
                        src={c.coverImageUrl}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="96px"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-lg">{c.title}</span>
                        <Badge variant="secondary">{level}</Badge>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground leading-relaxed line-clamp-3">
                        {c.summary}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
