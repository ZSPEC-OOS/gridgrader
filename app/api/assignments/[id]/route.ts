import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

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
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.assignment.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
