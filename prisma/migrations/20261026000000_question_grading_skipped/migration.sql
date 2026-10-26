-- Per-question "Grading Skipped" flag: instructor grades this question
-- themselves, so AI grading and the Canvas transfer leave it alone.
ALTER TABLE "Question" ADD COLUMN "gradingSkipped" BOOLEAN NOT NULL DEFAULT false;
