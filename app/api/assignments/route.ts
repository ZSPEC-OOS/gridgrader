import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseWorkbook } from "@/lib/parseWorkbook";

export async function GET() {
  const assignments = await prisma.assignment.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { students: true, questions: true } },
    },
  });

  return NextResponse.json(
    assignments.map((a) => ({
      id: a.id,
      name: a.name,
      status: a.status,
      studentCount: a._count.students,
      questionCount: a._count.questions,
      createdAt: a.createdAt,
      gradedAt: a.gradedAt,
    }))
  );
}

type CriteriaInput = {
  header: string;
  criteria: string;
  maxScore: number;
};

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");
  const name = form.get("name");
  const criteriaRaw = form.get("criteria");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file." }, { status: 400 });
  }
  if (typeof criteriaRaw !== "string") {
    return NextResponse.json(
      { error: "Missing grading criteria." },
      { status: 400 }
    );
  }

  let criteriaList: CriteriaInput[];
  try {
    criteriaList = JSON.parse(criteriaRaw);
  } catch {
    return NextResponse.json(
      { error: "Grading criteria payload was not valid JSON." },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let parsed;
  try {
    parsed = parseWorkbook(buffer);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to parse file." },
      { status: 400 }
    );
  }

  if (criteriaList.length !== parsed.questions.length) {
    return NextResponse.json(
      {
        error: `Criteria count (${criteriaList.length}) does not match question count (${parsed.questions.length}). Re-upload the file.`,
      },
      { status: 400 }
    );
  }

  const assignmentName =
    typeof name === "string" && name.trim() ? name.trim() : file.name;

  const assignment = await prisma.assignment.create({
    data: {
      name: assignmentName,
      sourceFile: file.name,
      status: "READY_TO_GRADE",
      questions: {
        create: parsed.questions.map((q, i) => ({
          index: q.index,
          header: q.header,
          criteria: criteriaList[i]?.criteria ?? "",
          maxScore:
            Number.isFinite(criteriaList[i]?.maxScore) &&
            criteriaList[i].maxScore > 0
              ? Math.round(criteriaList[i].maxScore)
              : 10,
        })),
      },
      students: {
        create: parsed.students.map((s) => ({
          index: s.index,
          name: s.name,
        })),
      },
    },
    include: { questions: true, students: true },
  });

  const questionByIndex = new Map(
    assignment.questions.map((q) => [q.index, q])
  );
  const studentByIndex = new Map(
    assignment.students.map((s) => [s.index, s])
  );

  const answerRows = parsed.students.flatMap((s) =>
    s.answers.map((text, qIndex) => {
      const student = studentByIndex.get(s.index);
      const question = questionByIndex.get(qIndex);
      if (!student || !question) return null;
      return {
        studentId: student.id,
        questionId: question.id,
        text,
      };
    })
  ).filter((r): r is { studentId: string; questionId: string; text: string } => r !== null);

  await prisma.answer.createMany({ data: answerRows });

  return NextResponse.json({ id: assignment.id }, { status: 201 });
}
