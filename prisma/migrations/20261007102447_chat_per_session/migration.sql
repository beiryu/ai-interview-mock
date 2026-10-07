-- Per-session chat: multiple chats per job allowed, each chat tied to a run.
DROP INDEX IF EXISTS "chat_conversations_job_id_key";

ALTER TABLE "chat_conversations" ADD COLUMN "session_id" TEXT;

CREATE UNIQUE INDEX "chat_conversations_session_id_key" ON "chat_conversations"("session_id");
CREATE INDEX "chat_conversations_job_id_idx" ON "chat_conversations"("job_id");

ALTER TABLE "chat_conversations"
  ADD CONSTRAINT "chat_conversations_session_id_fkey"
  FOREIGN KEY ("session_id") REFERENCES "interview_sessions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
