-- Per-question grading precision (1 = whole points, 0.5, 0.25).
ALTER TABLE "Question" ADD COLUMN "scoreStep" DOUBLE PRECISION NOT NULL DEFAULT 1;
