import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { gradeAnswer } from "@/lib/grading";
import { mapWithConcurrency } from "@/lib/concurrency";
import { toErrorMessage } from "@/lib/apiError";

const CONCURRENCY = 8;
const DEFAULT_BATCH_SIZE = 40;
const MAX_BATCH_SIZE = 100;

// Each request grades one small batch and returns, so a single call always
// finishes well within any Vercel plan's function timeout — the client
// loops, calling again with the next offset until `done` comes back true.
// This is what makes large rosters (hundreds of students) actually work:
// grading everything in one request would always eventually time out.
export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const body = await req.json().catch(() => ({}));
  const singleAnswerId =
    typeof body.answerId === "string" ? body.answerId : null;
  const offset =
    Number.isFinite(body.offset) && body.offset >= 0
      ? Math.floor(body.offset)
      : 0;
  const limit =
    Number.isFinite(body.limit) && body.limit > 0
      ? Math.min(Math.floor(body.limit), MAX_BATCH_SIZE)
      : DEFAULT_BATCH_SIZE;

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
        questions: { orderBy: { index: "asc" } },
        students: {
          orderBy: { index: "asc" },
          include: { answers: { include: { question: true } } },
        },
      },
    });

    if (!assignment) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
  } catch (err) {
    return NextResponse.json({ error: toErrorMessage(err) }, { status: 500 });
  }

  if (singleAnswerId) {
    const job = assignment.students
      .flatMap((student) => student.answers.map((answer) => ({ student, answer })))
      .find(({ answer }) => answer.id === singleAnswerId);

    if (!job) {
      return NextResponse.json({ error: "Answer not found." }, { status: 404 });
    }

    try {
      const result = await gradeAnswer({
        apiKey: settings.apiKey!,
        baseUrl: settings.baseUrl,
        model: settings.model,
        useMaxCompletionTokens: settings.useMaxCompletionTokens,
        questionHeader: job.answer.question.header,
        criteria: job.answer.question.criteria ?? "",
        maxScore: job.answer.question.maxScore,
        studentName: job.student.name,
        answerText: job.answer.text,
      });

      const grade = await prisma.grade.upsert({
        where: { answerId: job.answer.id },
        create: {
          answerId: job.answer.id,
          score: result.score,
          maxScore: job.answer.question.maxScore,
          feedback: result.feedback,
          model: settings.model,
        },
        update: {
          score: result.score,
          maxScore: job.answer.question.maxScore,
          feedback: result.feedback,
          model: settings.model,
          gradedAt: new Date(),
        },
      });

      // Make sure the assignment shows as graded if this was the first
      // successful grade it's ever gotten.
      if (assignment.status !== "GRADED") {
        await prisma.assignment.update({
          where: { id },
          data: { status: "GRADED", gradedAt: new Date() },
        });
      }

      return NextResponse.json({
        answerId: job.answer.id,
        score: grade.score,
        feedback: grade.feedback,
      });
    } catch (err) {
      return NextResponse.json(
        { error: toErrorMessage(err) },
        { status: 500 }
      );
    }
  }

  // Deterministic ordering across repeated batch calls: derive the job list
  // from the already-index-ordered students/questions rather than trusting
  // the raw `answers` array order, so offset-based paging can't skip or
  // duplicate an answer between requests.
  const questionById = new Map(assignment.questions.map((q) => [q.id, q]));
  const answerJobs = assignment.students.flatMap((student) => {
    const answerByQuestion = new Map(
      student.answers.map((a) => [a.questionId, a])
    );
    return assignment.questions
      .map((q) => {
        const answer = answerByQuestion.get(q.id);
        return answer ? { student, answer, question: questionById.get(q.id)! } : null;
      })
      .filter((j): j is NonNullable<typeof j> => j !== null);
  });

  const total = answerJobs.length;
  const batch = answerJobs.slice(offset, offset + limit);

  try {
    if (offset === 0) {
      await prisma.assignment.update({
        where: { id },
        data: { status: "GRADING" },
      });
    }
  } catch (err) {
    return NextResponse.json({ error: toErrorMessage(err) }, { status: 500 });
  }

  const errors: string[] = [];

  await mapWithConcurrency(batch, CONCURRENCY, async ({ student, answer, question }) => {
    try {
      const result = await gradeAnswer({
        apiKey: settings.apiKey!,
        baseUrl: settings.baseUrl,
        model: settings.model,
        useMaxCompletionTokens: settings.useMaxCompletionTokens,
        questionHeader: question.header,
        criteria: question.criteria ?? "",
        maxScore: question.maxScore,
        studentName: student.name,
        answerText: answer.text,
      });

      await prisma.grade.upsert({
        where: { answerId: answer.id },
        create: {
          answerId: answer.id,
          score: result.score,
          maxScore: question.maxScore,
          feedback: result.feedback,
          model: settings.model,
        },
        update: {
          score: result.score,
          maxScore: question.maxScore,
          feedback: result.feedback,
          model: settings.model,
          gradedAt: new Date(),
        },
      });
    } catch (err) {
      errors.push(
        `${student.name} / ${question.header}: ${
          err instanceof Error ? err.message : "unknown error"
        }`
      );
    }
  });

  const done = offset + limit >= total;

  if (done) {
    try {
      const gradedCount = await prisma.grade.count({
        where: { answer: { student: { assignmentId: id } } },
      });
      await prisma.assignment.update({
        where: { id },
        data: {
          status: gradedCount > 0 ? "GRADED" : "READY_TO_GRADE",
          gradedAt: gradedCount > 0 ? new Date() : undefined,
        },
      });
    } catch (err) {
      return NextResponse.json({ error: toErrorMessage(err) }, { status: 500 });
    }
  }

  return NextResponse.json({
    graded: batch.length - errors.length,
    failed: errors.length,
    errors,
    offset,
    limit,
    total,
    done,
  });
}
