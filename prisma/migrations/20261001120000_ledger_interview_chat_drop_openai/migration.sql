-- Session ledger, one chat per interview (old Document Chat conversations
-- are kept with interview_id NULL), and no more OpenAI vector store ids.

-- AlterTable
ALTER TABLE "chat_conversations" DROP COLUMN "documentIds",
DROP COLUMN "previous_response_id",
ADD COLUMN     "interview_id" TEXT,
ALTER COLUMN "title" SET DEFAULT '';

-- AlterTable
ALTER TABLE "chat_messages" DROP COLUMN "sources";

-- AlterTable
ALTER TABLE "documents" DROP COLUMN "openai_file_id";

-- AlterTable
ALTER TABLE "interview_sessions" ADD COLUMN     "ledger" JSONB;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "openai_vector_store_id";

-- CreateIndex
CREATE UNIQUE INDEX "chat_conversations_interview_id_key" ON "chat_conversations"("interview_id");

-- AddForeignKey
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_interview_id_fkey" FOREIGN KEY ("interview_id") REFERENCES "interviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

