"use client";

import { markCourseLessonComplete } from "@/app/actions/course-progress";
import { Button } from "@/components/ui/button";

export function CourseLessonCompleteButton({
  courseSlug,
  lessonIndex,
  completed,
}: {
  courseSlug: string;
  lessonIndex: number;
  completed: boolean;
}) {
  if (completed) {
    return (
      <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
        本节已完成
      </span>
    );
  }
  return (
    <form action={markCourseLessonComplete}>
      <input type="hidden" name="courseSlug" value={courseSlug} />
      <input type="hidden" name="lessonIndex" value={String(lessonIndex)} />
      <Button type="submit" size="sm" variant="secondary">
        标记本节已完成
      </Button>
    </form>
  );
}
