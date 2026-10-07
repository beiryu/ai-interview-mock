-- Jobs become the root: a job description, the CV sent for it and (once
-- invited) its interview. Renames keep every row; the JD documents an
-- interview had picked move into the job's own jd_text.

-- ─── interviews → jobs ───────────────────────────────────────────────────────
CREATE TYPE "JobStatus" AS ENUM ('SAVED', 'APPLIED', 'INTERVIEWING', 'OFFER', 'REJECTED', 'ARCHIVED');

ALTER TABLE "interviews" RENAME TO "jobs";
ALTER TABLE "jobs" RENAME CONSTRAINT "interviews_pkey" TO "jobs_pkey";
ALTER TABLE "jobs" RENAME CONSTRAINT "interviews_userId_fkey" TO "jobs_userId_fkey";
ALTER INDEX "interviews_userId_idx" RENAME TO "jobs_userId_idx";

ALTER TABLE "jobs" RENAME COLUMN "companyName" TO "company";
ALTER TABLE "jobs" RENAME COLUMN "jobTitle" TO "title";
UPDATE "jobs" SET "company" = '' WHERE "company" IS NULL;
UPDATE "jobs" SET "title" = "name" WHERE "title" IS NULL OR "title" = '';
ALTER TABLE "jobs" ALTER COLUMN "company" SET DEFAULT '', ALTER COLUMN "company" SET NOT NULL;
ALTER TABLE "jobs" ALTER COLUMN "title" SET DEFAULT '', ALTER COLUMN "title" SET NOT NULL;

ALTER TABLE "jobs"
  ADD COLUMN "jd_text" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "source_url" TEXT,
  ADD COLUMN "status" "JobStatus" NOT NULL DEFAULT 'SAVED';

-- The JD documents each interview had picked become its jd_text
UPDATE "jobs" j SET "jd_text" = sub.text
FROM (
  SELECT j2."id", string_agg(d."content", E'\n\n' ORDER BY d."created_at") AS text
  FROM "jobs" j2
  JOIN "documents" d ON d."id" = ANY (j2."document_ids") AND d."type" = 'JOB_DESCRIPTION'
  GROUP BY j2."id"
) sub
WHERE j."id" = sub."id";

-- Scheduled or already practised: interviewing
UPDATE "jobs" j SET "status" = 'INTERVIEWING'
WHERE j."scheduledAt" IS NOT NULL
   OR EXISTS (SELECT 1 FROM "interview_sessions" s WHERE s."interviewId" = j."id");

ALTER TABLE "jobs" DROP COLUMN "name", DROP COLUMN "document_ids";

-- ─── child tables: interviewId → jobId ───────────────────────────────────────
ALTER TABLE "interview_sessions" RENAME COLUMN "interviewId" TO "jobId";
ALTER TABLE "interview_sessions" RENAME CONSTRAINT "interview_sessions_interviewId_fkey" TO "interview_sessions_jobId_fkey";
ALTER INDEX "interview_sessions_interviewId_idx" RENAME TO "interview_sessions_jobId_idx";

ALTER TABLE "interview_preps" RENAME TO "job_preps";
ALTER TABLE "job_preps" RENAME COLUMN "interviewId" TO "jobId";
ALTER TABLE "job_preps" RENAME CONSTRAINT "interview_preps_pkey" TO "job_preps_pkey";
ALTER TABLE "job_preps" RENAME CONSTRAINT "interview_preps_interviewId_fkey" TO "job_preps_jobId_fkey";
ALTER INDEX "interview_preps_interviewId_key" RENAME TO "job_preps_jobId_key";

ALTER TABLE "tailored_cvs" RENAME COLUMN "interviewId" TO "jobId";
ALTER TABLE "tailored_cvs" RENAME CONSTRAINT "tailored_cvs_interviewId_fkey" TO "tailored_cvs_jobId_fkey";
ALTER INDEX "tailored_cvs_interviewId_key" RENAME TO "tailored_cvs_jobId_key";

ALTER TABLE "chat_conversations" RENAME COLUMN "interview_id" TO "job_id";
ALTER TABLE "chat_conversations" RENAME CONSTRAINT "chat_conversations_interview_id_fkey" TO "chat_conversations_job_id_fkey";
ALTER INDEX "chat_conversations_interview_id_key" RENAME TO "chat_conversations_job_id_key";

-- ─── documents: only about you now ───────────────────────────────────────────
DELETE FROM "documents" WHERE "type" = 'JOB_DESCRIPTION';

CREATE TYPE "DocumentType_new" AS ENUM ('RESUME', 'COVER_LETTER', 'PORTFOLIO', 'NOTES', 'PROJECT_DOCUMENTATION');
ALTER TABLE "documents" ALTER COLUMN "type" TYPE "DocumentType_new" USING ("type"::text::"DocumentType_new");
DROP TYPE "DocumentType";
ALTER TYPE "DocumentType_new" RENAME TO "DocumentType";
