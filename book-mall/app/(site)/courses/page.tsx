import { CoursesCatalog } from "@/components/courses/courses-catalog";

export const metadata = {
  title: "AI 学堂 — AI Mall",
  description: "会员课程学习入口；知识与订阅权益联动。",
};

export const dynamic = "force-dynamic";

export default function CoursesIndexPage() {
  return (
    <main className="pb-16 pt-8 md:pt-12">
      <div className="mx-auto max-w-3xl space-y-8 px-4">
        <CoursesCatalog />
      </div>
    </main>
  );
}
