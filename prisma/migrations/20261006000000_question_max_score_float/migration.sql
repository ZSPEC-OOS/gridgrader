-- Allow decimal question point values (e.g. 1.5); existing integers are preserved.
ALTER TABLE "Question" ALTER COLUMN "maxScore" SET DATA TYPE DOUBLE PRECISION;
