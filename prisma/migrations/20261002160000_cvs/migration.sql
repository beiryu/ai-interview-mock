-- One concept: a CV. Your uploaded documents become UPLOADED CVs; each
-- job's tailored CV becomes a REFINED CV based on your uploaded one. The
-- profile prep goes away (a job's prep is built from its CV), and the
-- structured CV content is rebuilt by the app (status 'pending').

CREATE TYPE "CvOrigin" AS ENUM ('UPLOADED', 'REFINED', 'GENERATED');

ALTER TABLE "jobs" ADD COLUMN "answers" JSONB;

CREATE TABLE "cvs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "origin" "CvOrigin" NOT NULL,
    "based_on_id" TEXT,
    "job_id" TEXT,
    "raw_text" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "source_hash" TEXT,
    "content" JSONB,
    "error" TEXT,
    "started_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cvs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cvs_job_id_key" ON "cvs"("job_id");
CREATE INDEX "cvs_userId_idx" ON "cvs"("userId");

ALTER TABLE "cvs" ADD CONSTRAINT "cvs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cvs" ADD CONSTRAINT "cvs_based_on_id_fkey" FOREIGN KEY ("based_on_id") REFERENCES "cvs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cvs" ADD CONSTRAINT "cvs_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── data ────────────────────────────────────────────────────────────────────
-- Uploaded documents → UPLOADED CVs (text kept; parsed again by the app)
INSERT INTO "cvs" ("id", "userId", "title", "origin", "raw_text", "status", "created_at", "updated_at")
SELECT 'cv' || d."id", d."userId", d."title", 'UPLOADED', d."content", 'pending', d."created_at", CURRENT_TIMESTAMP
FROM "documents" d;

-- Each job's tailored CV → a REFINED CV based on the user's resume
INSERT INTO "cvs" ("id", "userId", "title", "origin", "based_on_id", "job_id", "status", "created_at", "updated_at")
SELECT t."id", j."userId",
       trim(both ' — ' from concat_ws(' — ', nullif(j."company", ''), nullif(j."title", ''))),
       'REFINED',
       (SELECT 'cv' || d."id" FROM "documents" d
         WHERE d."userId" = j."userId"
         ORDER BY (d."type" = 'RESUME') DESC, d."created_at" ASC
         LIMIT 1),
       j."id", 'pending', t."created_at", CURRENT_TIMESTAMP
FROM "tailored_cvs" t
JOIN "jobs" j ON j."id" = t."jobId";

-- Job preps cite profile facts (P*) that no longer exist: rebuilt from the CV
DELETE FROM "job_preps";

-- ─── old tables ──────────────────────────────────────────────────────────────
ALTER TABLE "documents" DROP CONSTRAINT "documents_userId_fkey";
ALTER TABLE "profile_preps" DROP CONSTRAINT "profile_preps_userId_fkey";
ALTER TABLE "tailored_cvs" DROP CONSTRAINT "tailored_cvs_jobId_fkey";
DROP TABLE "documents";
DROP TABLE "profile_preps";
DROP TABLE "tailored_cvs";
DROP TYPE "DocumentType";
