-- Better Auth requires user.name and user.email to be strings. NextAuth
-- magic-link sign-ups left name NULL, which made every session cookie-cache
-- payload fail validation (forcing a DB lookup per request).
UPDATE "users" SET "name" = '' WHERE "name" IS NULL;

ALTER TABLE "users" ALTER COLUMN "name" SET NOT NULL,
ALTER COLUMN "name" SET DEFAULT '',
ALTER COLUMN "email" SET NOT NULL;
