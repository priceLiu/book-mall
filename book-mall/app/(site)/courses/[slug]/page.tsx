import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getPublishedKnowledgeProduct } from "@/lib/courses-published";
import { parseCourseContentJson } from "@/lib/course-content-json";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProductDescriptionBody } from "@/components/products/product-description-body";

type Props = { params: { slug: string } };

export const dynamic = "force-dynamic";

const tierZh: Record<string, string> = {
  BASIC: "入门",
  ADVANCED: "进阶",
};

export async function generateMetadata({ params }: Props) {
  const c = await getPublishedKnowledgeProduct(params.slug);
  return {
    title: c ? `${c.title} — AI 学堂` : "课程 — AI Mall",
  };
}

export default async function CourseDetailPage({ params }: Props) {
  const course = await getPublishedKnowledgeProduct(params.slug);
  if (!course) notFound();

  const parsed = parseCourseContentJson(course.courseContent);
  const level =
    parsed?.level ??
    (course.tier === "ADVANCED" ? tierZh.ADVANCED : tierZh.BASIC);
  const lessons = parsed?.lessons ?? [];
  const totalMin = lessons.reduce((s, x) => s + (x.durationMin ?? 0), 0);

  return (
    <main className="pb-16 pt-8 md:pt-12">
      <article className="mx-auto max-w-3xl px-4 space-y-8">
        <p className="text-sm text-muted-foreground">
          <Link href="/courses" className="text-primary underline">
            ← 返回课程列表
          </Link>
        </p>

        <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-start">
          <div className="relative mx-auto h-36 w-36 shrink-0 overflow-hidden rounded-lg bg-muted sm:mx-0">
            <Image
              src={course.coverImageUrl}
              alt=""
              fill
              className="object-cover"
              sizes="144px"
            />
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">知识型课程</Badge>
              <Badge variant="secondary">{level}</Badge>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">{course.title}</h1>
            <p className="text-muted-foreground leading-relaxed">{course.summary}</p>
            {lessons.length > 0 ? (
              <p className="text-sm text-muted-foreground">
                纲要合计约 {totalMin} 分钟（示意时长）。
              </p>
            ) : null}
            <Button asChild>
              <Link href={`/courses/${course.slug}/learn`}>开始学习</Link>
            </Button>
          </div>
        </header>

        <section aria-labelledby="outline-heading">
          <h2 id="outline-heading" className="text-lg font-semibold mb-4">
            课程纲要
          </h2>
          {lessons.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              后台尚未配置课时 JSON（<code className="font-mono text-xs">courseContent</code>
              ）。
            </p>
          ) : (
            <ol className="list-decimal pl-5 space-y-3 text-sm">
              {lessons.map((item, i) => (
                <li key={i} className="leading-relaxed">
                  <span className="font-medium">{item.title}</span>
                  {item.durationMin != null ? (
                    <span className="text-muted-foreground">
                      {" "}
                      · 约 {item.durationMin} 分钟
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </section>

        <section aria-labelledby="course-desc-heading" className="rounded-lg border border-dashed border-border p-4">
          <h2 id="course-desc-heading" className="sr-only">
            课程介绍
          </h2>
          <ProductDescriptionBody
            description={course.description}
            format={course.descriptionFormat}
          />
        </section>
      </article>
    </main>
  );
}
