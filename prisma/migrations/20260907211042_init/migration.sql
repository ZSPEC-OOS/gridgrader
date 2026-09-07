-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('CRITERIA_PENDING', 'READY_TO_GRADE', 'GRADING', 'GRADED');

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceFile" TEXT NOT NULL,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'CRITERIA_PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "gradedAt" TIMESTAMP(3),

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "header" TEXT NOT NULL,
    "criteria" TEXT,
    "maxScore" INTEGER NOT NULL DEFAULT 10,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Answer" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "text" TEXT NOT NULL,

    CONSTRAINT "Answer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Grade" (
    "id" TEXT NOT NULL,
    "answerId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "maxScore" DOUBLE PRECISION NOT NULL,
    "feedback" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "gradedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Grade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "provider" TEXT NOT NULL DEFAULT 'openai',
    "apiKey" TEXT,
    "model" TEXT NOT NULL DEFAULT 'gpt-4o-mini',

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Question_assignmentId_index_key" ON "Question"("assignmentId", "index");

-- CreateIndex
CREATE UNIQUE INDEX "Student_assignmentId_index_key" ON "Student"("assignmentId", "index");

-- CreateIndex
CREATE UNIQUE INDEX "Answer_studentId_questionId_key" ON "Answer"("studentId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "Grade_answerId_key" ON "Grade"("answerId");

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "Answer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
