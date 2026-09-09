-- Replace the percentage-based grading tolerance with a 5-level semantic
-- strictness setting. The two represent different concepts, so existing
-- tolerance values are not mathematically converted — every row resets to
-- the documented default (3 / Balanced) via the column default below.
ALTER TABLE "Settings" ADD COLUMN     "gradingStrictnessLevel" INTEGER NOT NULL DEFAULT 3;

ALTER TABLE "Settings" DROP COLUMN "gradingTolerancePercent";
