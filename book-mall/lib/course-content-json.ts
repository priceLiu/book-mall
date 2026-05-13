/** Product.courseContent JSON（知识型课程） */
export type CourseLessonJson = {
  title: string;
  durationMin?: number;
  /** 正文 Markdown（简化渲染为纯文本段落亦可） */
  bodyMd?: string;
};

export type CourseContentJson = {
  level?: string;
  lessons: CourseLessonJson[];
};

export function parseCourseContentJson(
  raw: string | null | undefined,
): CourseContentJson | null {
  if (!raw?.trim()) return null;
  try {
    const j = JSON.parse(raw) as Record<string, unknown>;
    if (!j || typeof j !== "object") return null;
    const lessonsRaw = j.lessons;
    if (!Array.isArray(lessonsRaw)) return null;
    const lessons: CourseLessonJson[] = [];
    for (const row of lessonsRaw) {
      if (!row || typeof row !== "object") continue;
      const o = row as Record<string, unknown>;
      const title = typeof o.title === "string" ? o.title.trim() : "";
      if (!title) continue;
      const durationMin =
        typeof o.durationMin === "number" && Number.isFinite(o.durationMin)
          ? Math.max(0, Math.floor(o.durationMin))
          : undefined;
      const bodyMd =
        typeof o.bodyMd === "string" && o.bodyMd.trim() ? o.bodyMd.trim() : undefined;
      lessons.push({ title, durationMin, bodyMd });
    }
    if (lessons.length === 0) return null;
    const level = typeof j.level === "string" ? j.level.trim() : undefined;
    return { level: level || undefined, lessons };
  } catch {
    return null;
  }
}
