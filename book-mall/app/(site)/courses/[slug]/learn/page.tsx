import Link from "next/link";
import { notFound } from "next/navigation";
import { CourseLessonCompleteButton } from "@/components/courses/course-lesson-complete-button";
import { assertCourseLearnAccess } from "@/lib/assert-course-learn-access";
import { prisma } from "@/lib/prisma";
import { getPublishedKnowledgeProduct } from "@/lib/courses-published";
import { parseCourseContentJson } from "@/lib/course-content-json";

type Props = { params: { slug: string } };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props) {
  const c = await getPublishedKnowledgeProduct(params.slug);
  return { title: c ? `学习 · ${c.title}` : "学习 — AI 学堂" };
}

export default async function CourseLearnPage({ params }: Props) {
  const course = await getPublishedKnowledgeProduct(params.slug);
  if (!course) notFound();

  const session = await assertCourseLearnAccess({
    callbackPath: `/courses/${course.slug}/learn`,
    courseSlug: course.slug,
  });

  const parsed = parseCourseContentJson(course.courseContent);
  const lessons = parsed?.lessons ?? [];

  const progressRows =
    lessons.length > 0
      ? await prisma.courseLessonProgress.findMany({
          where: { userId: session.user.id, courseSlug: course.slug },
        })
      : [];

  const completedIdx = new Set(
    progressRows.filter((r) => r.completedAt != null).map((r) => r.lessonIndex),
  );

  return (
    <main className="pb-16 pt-8 md:pt-12">
      <div className="mx-auto max-w-3xl px-4 space-y-6">
        <p className="text-sm text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
          <Link href="/courses" className="text-primary underline">
            学堂首页
          </Link>
          <Link href={`/courses/${course.slug}`} className="text-primary underline">
            课程介绍
          </Link>
        </p>

        <header className="space-y-2 border-b border-border pb-4">
          <h1 className="text-2xl font-bold tracking-tight">{course.title}</h1>
          <p className="text-sm text-muted-foreground">
            播放器占位：展示课时正文与完成标记；后续可替换视频进度条并与本节字段对齐。
          </p>
        </header>

        {lessons.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            该课程尚未配置 <code className="font-mono text-xs">courseContent</code> 课时数组。
          </p>
        ) : (
          <ol className="space-y-10">
            {lessons.map((lesson, index) => (
              <li
                key={index}
                className="rounded-xl border border-border bg-card p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground font-mono">
                      第 {index + 1} 节
                    </p>
                    <h2 className="text-lg font-semibold">{lesson.title}</h2>
                    {lesson.durationMin != null ? (
                      <p className="text-xs text-muted-foreground mt-1">
                        约 {lesson.durationMin} 分钟
                      </p>
                    ) : null}
                  </div>
                  <CourseLessonCompleteButton
                    courseSlug={course.slug}
                    lessonIndex={index}
                    completed={completedIdx.has(index)}
                  />
                </div>
                <div className="mt-4 prose prose-sm dark:prose-invert max-w-none">
                  {lesson.bodyMd ? (
                    <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-muted-foreground bg-muted/40 rounded-md p-4 border border-border">
                      {lesson.bodyMd}
                    </pre>
                  ) : (
                    <p className="text-sm text-muted-foreground">本节暂无正文。</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </main>
  );
}
