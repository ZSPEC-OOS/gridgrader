import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { gradeAnswer } from "@/lib/grading";
import { mapWithConcurrency } from "@/lib/concurrency";
import { toErrorMessage } from "@/lib/apiError";

const CONCURRENCY = 5;

// Grading loops over every student x question answer synchronously, which
// can take a while for larger classes. Extend the serverless function
// timeout accordingly (adjust for your Vercel plan's max).
export const maxDuration = 300;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let settings, assignment;
  try {
    settings = await prisma.settings.findUnique({ where: { id: 1 } });
    if (!settings?.apiKey) {
      return NextResponse.json(
        { error: "No AI model configured. Add an API key on the Settings page first." },
        { status: 400 }
      );
    }

    assignment = await prisma.assignment.findUnique({
      where: { id },
      include: {
        questions: true,
        students: {
          include: { answers: { include: { question: true } } },
        },
      },
    });

    if (!assignment) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    await prisma.assignment.update({
      where: { id },
      data: { status: "GRADING" },
    });
  } catch (err) {
    return NextResponse.json({ error: toErrorMessage(err) }, { status: 500 });
  }

  const answerJobs = assignment.students.flatMap((student) =>
    student.answers.map((answer) => ({ student, answer }))
  );

  const errors: string[] = [];

  await mapWithConcurrency(answerJobs, CONCURRENCY, async ({ student, answer }) => {
    try {
      const result = await gradeAnswer({
        apiKey: settings.apiKey!,
        baseUrl: settings.baseUrl,
        model: settings.model,
        questionHeader: answer.question.header,
        criteria: answer.question.criteria ?? "",
        maxScore: answer.question.maxScore,
        studentName: student.name,
        answerText: answer.text,
      });

      await prisma.grade.upsert({
        where: { answerId: answer.id },
        create: {
          answerId: answer.id,
          score: result.score,
          maxScore: answer.question.maxScore,
          feedback: result.feedback,
          model: settings.model,
        },
        update: {
          score: result.score,
          maxScore: answer.question.maxScore,
          feedback: result.feedback,
          model: settings.model,
          gradedAt: new Date(),
        },
      });
    } catch (err) {
      errors.push(
        `${student.name} / ${answer.question.header}: ${
          err instanceof Error ? err.message : "unknown error"
        }`
      );
    }
  });

  const allFailed = answerJobs.length > 0 && errors.length === answerJobs.length;

  try {
    await prisma.assignment.update({
      where: { id },
      data: {
        status: allFailed ? "READY_TO_GRADE" : "GRADED",
        gradedAt: allFailed ? undefined : new Date(),
      },
    });
  } catch (err) {
    return NextResponse.json({ error: toErrorMessage(err) }, { status: 500 });
  }

  return NextResponse.json({
    graded: answerJobs.length - errors.length,
    total: answerJobs.length,
    errors,
  });
}
