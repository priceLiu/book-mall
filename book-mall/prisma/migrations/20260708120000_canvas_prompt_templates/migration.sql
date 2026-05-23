-- CreateEnum
CREATE TYPE "CanvasPromptEngineKind" AS ENUM ('LLM', 'IMAGE');

-- CreateTable
CREATE TABLE "CanvasPromptTemplate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "engine" "CanvasPromptEngineKind" NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CanvasPromptTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CanvasPromptTemplate_userId_engine_sortOrder_idx" ON "CanvasPromptTemplate"("userId", "engine", "sortOrder");

-- AddForeignKey
ALTER TABLE "CanvasPromptTemplate" ADD CONSTRAINT "CanvasPromptTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
