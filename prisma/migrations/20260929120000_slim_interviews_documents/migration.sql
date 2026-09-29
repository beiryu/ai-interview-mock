-- Personal-use cleanup: keep only fields the app actually reads/writes.

-- ─── interview_sessions ──────────────────────────────────────────────────────
-- Every existing session is an empty shell (transcripts NULL, feedback '',
-- duration 0): sessions were created on every playground mount and never
-- saved anything. Drop them before reshaping the table.
DELETE FROM "interview_sessions";

ALTER TABLE "interview_sessions" DROP COLUMN "duration",
DROP COLUMN "feedback",
DROP COLUMN "title",
DROP COLUMN "transcripts",
ADD COLUMN "transcript" JSONB,
ADD COLUMN "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "endedAt" TIMESTAMP(3);

-- ─── interviews ──────────────────────────────────────────────────────────────
-- type/status/priority were demo "task" fields (every row: live/in-progress/high).
-- dueDate keeps its values as the optional scheduledAt.
ALTER TABLE "interviews" DROP COLUMN "priority",
DROP COLUMN "status",
DROP COLUMN "type",
ALTER COLUMN "jobTitle" DROP NOT NULL,
ALTER COLUMN "companyName" DROP NOT NULL;

ALTER TABLE "interviews" RENAME COLUMN "dueDate" TO "scheduledAt";
ALTER TABLE "interviews" ALTER COLUMN "scheduledAt" DROP NOT NULL;

UPDATE "interviews" SET "jobTitle" = NULL WHERE "jobTitle" = '';
UPDATE "interviews" SET "companyName" = NULL WHERE "companyName" = '';

-- ─── documents ───────────────────────────────────────────────────────────────
-- fileUrl was never set; metadata only duplicated userId/type/title.
ALTER TABLE "documents" DROP COLUMN "fileUrl",
DROP COLUMN "metadata";

-- TRANSCRIPT was never used.
CREATE TYPE "DocumentType_new" AS ENUM ('RESUME', 'COVER_LETTER', 'PORTFOLIO', 'JOB_DESCRIPTION', 'NOTES', 'PROJECT_DOCUMENTATION');
ALTER TABLE "documents" ALTER COLUMN "type" TYPE "DocumentType_new" USING ("type"::text::"DocumentType_new");
ALTER TYPE "DocumentType" RENAME TO "DocumentType_old";
ALTER TYPE "DocumentType_new" RENAME TO "DocumentType";
DROP TYPE "public"."DocumentType_old";

-- ─── foreign-key indexes ─────────────────────────────────────────────────────
CREATE INDEX "chat_conversations_userId_idx" ON "chat_conversations"("userId");
CREATE INDEX "chat_messages_conversationId_idx" ON "chat_messages"("conversationId");
CREATE INDEX "documents_userId_idx" ON "documents"("userId");
CREATE INDEX "interview_sessions_interviewId_idx" ON "interview_sessions"("interviewId");
CREATE INDEX "interview_sessions_userId_idx" ON "interview_sessions"("userId");
CREATE INDEX "interviews_userId_idx" ON "interviews"("userId");
