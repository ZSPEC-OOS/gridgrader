import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { toErrorMessage } from "@/lib/apiError";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const assignment = await prisma.assignment.findUnique({
      where: { id },
      include: {
        questions: { orderBy: { index: "asc" } },
        students: {
          orderBy: { index: "asc" },
          include: {
            answers: {
              include: { grade: true },
            },
          },
        },
      },
    });

    if (!assignment) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    return NextResponse.json(assignment);
  } catch (err) {
    return NextResponse.json({ error: toErrorMessage(err) }, { status: 500 });
  }
}

type QuestionUpdate = {
  id: string;
  criteria: string;
  maxScore: number;
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const questions: QuestionUpdate[] = Array.isArray(body.questions)
    ? body.questions
    : [];

  if (!name) {
    return NextResponse.json(
      { error: "Assignment name can't be empty." },
      { status: 400 }
    );
  }

  try {
    const existing = await prisma.assignment.findUnique({
      where: { id },
      include: { questions: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const validIds = new Set(existing.questions.map((q) => q.id));

    await prisma.$transaction([
      prisma.assignment.update({
        where: { id },
        data: {
          name,
          // Editing criteria can invalidate any existing grades, so make
          // that visible — but only if it had actually been graded before.
          status:
            existing.status === "GRADED" || existing.status === "GRADING"
              ? "READY_TO_GRADE"
              : existing.status,
        },
      }),
      ...questions
        .filter((q) => validIds.has(q.id))
        .map((q) =>
          prisma.question.update({
            where: { id: q.id },
            data: {
              criteria: q.criteria ?? "",
              maxScore:
                Number.isFinite(q.maxScore) && q.maxScore > 0
                  ? Math.round(q.maxScore)
                  : 10,
            },
          })
        ),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: toErrorMessage(err) }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await prisma.assignment.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: toErrorMessage(err) }, { status: 500 });
  }
}
