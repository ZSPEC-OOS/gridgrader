-- Allow question maxima such as 1.5 while preserving existing integer values.
ALTER TABLE "Question"
ALTER COLUMN "maxScore" TYPE DOUBLE PRECISION
USING "maxScore"::DOUBLE PRECISION;
