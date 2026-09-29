-- Documents the answer coach reads per interview (replaces live file_search)
ALTER TABLE "interviews" ADD COLUMN "document_ids" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- The brief is built from the interview on every answer; no per-session snapshot
ALTER TABLE "interview_sessions" DROP COLUMN "sessionContext";
