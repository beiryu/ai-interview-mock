-- CreateTable
CREATE TABLE "profile_preps" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "source_hash" TEXT,
    "content" JSONB,
    "error" TEXT,
    "started_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profile_preps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_preps" (
    "id" TEXT NOT NULL,
    "interviewId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "source_hash" TEXT,
    "content" JSONB,
    "error" TEXT,
    "started_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interview_preps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "profile_preps_userId_key" ON "profile_preps"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "interview_preps_interviewId_key" ON "interview_preps"("interviewId");

-- AddForeignKey
ALTER TABLE "profile_preps" ADD CONSTRAINT "profile_preps_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_preps" ADD CONSTRAINT "interview_preps_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "interviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

