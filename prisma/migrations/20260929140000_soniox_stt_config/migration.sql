-- Deepgram -> Soniox: the old transcription knobs don't map onto Soniox's
-- semantic endpointing, so they are dropped rather than converted.
ALTER TABLE "user_configs" DROP COLUMN "deepgramModel",
DROP COLUMN "deepgramLanguage",
DROP COLUMN "utteranceEndMs",
DROP COLUMN "deepgramEndpointing",
DROP COLUMN "silenceThresholdMs",
ADD COLUMN "endpointMaxDelayMs" INTEGER,
ADD COLUMN "endpointSensitivity" DOUBLE PRECISION,
ADD COLUMN "turnMaxSilenceMs" INTEGER;
