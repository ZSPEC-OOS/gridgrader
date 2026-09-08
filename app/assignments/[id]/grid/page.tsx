import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { GradeTable } from "./GradeTable";

export default async function GridPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const assignment = await prisma.assignment.findUnique({
    where: { id },
    include: {
      questions: { orderBy: { index: "asc" } },
      students: {
        orderBy: { index: "asc" },
        include: { answers: { include: { grade: true } } },
      },
    },
  });

  if (!assignment) notFound();

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {assignment.name}
          </h1>
          <p className="mt-1 text-sm text-neutral-600 dark:text-muted">
            {assignment.students.length} students ·{" "}
            {assignment.questions.length} questions
            {assignment.gradedAt &&
              ` · graded ${new Date(assignment.gradedAt).toLocaleString()}`}
          </p>
        </div>
        <Link href="/" className="text-sm text-neutral-600 hover:text-brand-maroon dark:text-muted dark:hover:text-brand-crimson">
          ← Back to Grading
        </Link>
      </div>

      <GradeTable
        assignmentId={assignment.id}
        questions={assignment.questions.map((q) => ({
          id: q.id,
          header: q.header,
          maxScore: q.maxScore,
        }))}
        students={assignment.students.map((s) => ({
          id: s.id,
          name: s.name,
          answers: s.answers.map((a) => ({
            id: a.id,
            questionId: a.questionId,
            grade: a.grade
              ? { score: a.grade.score, feedback: a.grade.feedback }
              : null,
          })),
        }))}
      />
    </div>
  );
}
