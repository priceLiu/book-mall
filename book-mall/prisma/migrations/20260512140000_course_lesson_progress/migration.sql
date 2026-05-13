-- CreateTable
CREATE TABLE "CourseLessonProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseSlug" TEXT NOT NULL,
    "lessonIndex" INTEGER NOT NULL,
    "watchedSec" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseLessonProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CourseLessonProgress_userId_courseSlug_lessonIndex_key" ON "CourseLessonProgress"("userId", "courseSlug", "lessonIndex");

-- CreateIndex
CREATE INDEX "CourseLessonProgress_userId_courseSlug_idx" ON "CourseLessonProgress"("userId", "courseSlug");

-- AddForeignKey
ALTER TABLE "CourseLessonProgress" ADD CONSTRAINT "CourseLessonProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
