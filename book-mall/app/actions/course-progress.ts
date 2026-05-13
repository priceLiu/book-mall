"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function markCourseLessonComplete(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("请先登录");

  const courseSlug = String(formData.get("courseSlug") ?? "").trim();
  const lessonIndex = Number(formData.get("lessonIndex"));
  if (!courseSlug || !Number.isInteger(lessonIndex) || lessonIndex < 0) {
    throw new Error("参数无效");
  }

  await prisma.courseLessonProgress.upsert({
    where: {
      userId_courseSlug_lessonIndex: {
        userId: session.user.id,
        courseSlug,
        lessonIndex,
      },
    },
    create: {
      userId: session.user.id,
      courseSlug,
      lessonIndex,
      watchedSec: 0,
      completedAt: new Date(),
    },
    update: {
      completedAt: new Date(),
    },
  });

  revalidatePath(`/courses/${courseSlug}/learn`);
}
