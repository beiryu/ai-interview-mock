-- AlterTable
ALTER TABLE "interview_sessions" ADD COLUMN     "answers" JSONB;

-- CreateTable
CREATE TABLE "interview_screenshots" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "model" TEXT,
    "thread" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interview_screenshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "interview_screenshots_sessionId_idx" ON "interview_screenshots"("sessionId");

-- AddForeignKey
ALTER TABLE "interview_screenshots" ADD CONSTRAINT "interview_screenshots_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "interview_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
