-- Migrate auth tables from NextAuth (Prisma adapter) to Better Auth.
-- Hand-written to preserve users.emailVerified and OAuth token expiry.

-- ─── users ───────────────────────────────────────────────────────────────────
-- emailVerified: DateTime? -> Boolean (verified iff a timestamp was set)
ALTER TABLE "users" RENAME COLUMN "emailVerified" TO "emailVerified_old";
ALTER TABLE "users" ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT false;
UPDATE "users" SET "emailVerified" = ("emailVerified_old" IS NOT NULL);
ALTER TABLE "users" DROP COLUMN "emailVerified_old";

-- ─── accounts ────────────────────────────────────────────────────────────────
-- provider/providerAccountId/access_token/refresh_token/id_token keep their
-- column names (mapped in schema.prisma); expires_at (unix seconds) -> timestamp
ALTER TABLE "accounts"
ADD COLUMN "access_token_expires_at" TIMESTAMP(3),
ADD COLUMN "refresh_token_expires_at" TIMESTAMP(3),
ADD COLUMN "password" TEXT;

UPDATE "accounts"
SET "access_token_expires_at" = to_timestamp("expires_at")
WHERE "expires_at" IS NOT NULL;

ALTER TABLE "accounts"
DROP COLUMN "expires_at",
DROP COLUMN "session_state",
DROP COLUMN "token_type",
DROP COLUMN "type";

-- ─── sessions ────────────────────────────────────────────────────────────────
-- NextAuth used JWT sessions, so this table held no live data. Recreate it.
DROP TABLE "sessions";

CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── verifications ───────────────────────────────────────────────────────────
-- Pending NextAuth magic-link tokens are not portable; users request a new link.
DROP TABLE "verification_tokens";

CREATE TABLE "verifications" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "verifications_identifier_idx" ON "verifications"("identifier");
