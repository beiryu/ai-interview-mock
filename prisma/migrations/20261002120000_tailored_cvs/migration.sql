-- CreateTable
CREATE TABLE "tailored_cvs" (
    "id" TEXT NOT NULL,
    "interviewId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "source_hash" TEXT,
    "content" JSONB,
    "error" TEXT,
    "started_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tailored_cvs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tailored_cvs_interviewId_key" ON "tailored_cvs"("interviewId");

-- AddForeignKey
ALTER TABLE "tailored_cvs" ADD CONSTRAINT "tailored_cvs_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "interviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

