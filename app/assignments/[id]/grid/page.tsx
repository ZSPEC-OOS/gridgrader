import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { GradeCell } from "./GradeCell";

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
        include: { answers: { include: { grade: true, question: true } } },
      },
    },
  });

  if (!assignment) notFound();

  const totalMax = assignment.questions.reduce((s, q) => s + q.maxScore, 0);

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

      <div className="mt-6 overflow-x-auto rounded-lg border border-neutral-200 bg-white dark:border-border dark:bg-surface">
        <table className="w-full min-w-max border-collapse text-sm">
          <thead>
            <tr className="bg-neutral-50 text-left text-xs uppercase text-neutral-500 dark:bg-surface-muted dark:text-muted">
              <th className="sticky left-0 z-10 bg-neutral-50 px-4 py-3 dark:bg-surface-muted">
                Student
              </th>
              {assignment.questions.map((q) => (
                <th key={q.id} className="px-4 py-3 whitespace-nowrap">
                  {q.header}
                  <span className="ml-1 font-normal normal-case text-neutral-400 dark:text-muted">
                    ({q.maxScore} pts)
                  </span>
                </th>
              ))}
              <th className="px-4 py-3 whitespace-nowrap">Total</th>
            </tr>
          </thead>
          <tbody className="text-neutral-900 dark:text-foreground">
            {assignment.students.map((student) => {
              const answerByQuestion = new Map(
                student.answers.map((a) => [a.questionId, a])
              );
              const total = student.answers.reduce(
                (s, a) => s + (a.grade?.score ?? 0),
                0
              );
              const anyGraded = student.answers.some((a) => a.grade);

              return (
                <tr key={student.id} className="border-t border-neutral-100 dark:border-border">
                  <td className="sticky left-0 z-10 bg-white px-4 py-2 font-medium dark:bg-surface">
                    {student.name}
                  </td>
                  {assignment.questions.map((q) => {
                    const answer = answerByQuestion.get(q.id);
                    return (
                      <td key={q.id} className="px-4 py-2">
                        <GradeCell
                          score={answer?.grade?.score ?? null}
                          maxScore={q.maxScore}
                          feedback={answer?.grade?.feedback ?? null}
                        />
                      </td>
                    );
                  })}
                  <td className="px-4 py-2 text-sm font-semibold">
                    {anyGraded ? `${total.toFixed(1)} / ${totalMax}` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
