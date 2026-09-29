-- Three overlapping turn-taking knobs become one preset (fast/balanced/patient).
-- Existing values were all unset (defaults), which is "balanced" = NULL.
ALTER TABLE "user_configs" DROP COLUMN "endpointMaxDelayMs",
DROP COLUMN "endpointSensitivity",
DROP COLUMN "turnMaxSilenceMs",
ADD COLUMN "turnPace" TEXT;
