import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { toErrorMessage } from "@/lib/apiError";

// Individual answers are written to the database as soon as each one
// finishes grading (see the per-item callback in ../route.ts), well before
// a batch's HTTP response returns. Polling this endpoint while a grading
// run is in flight gives a genuinely live readout instead of one that only
// advances at batch boundaries.
//
// `since` filters to grades touched at or after a given timestamp, so a
// re-grade run (where most Grade rows already exist and are only updated,
// not created) doesn't start the bar near 100%. Callers should use the
// `serverTime` this endpoint returns — not their own clock — as `since` on
// subsequent polls, to avoid client/server clock skew.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const since = req.nextUrl.searchParams.get("since");
  const sinceDate = since ? new Date(since) : null;

  try {
    const total = await prisma.answer.count({
      where: { student: { assignmentId: id } },
    });

    const graded = await prisma.grade.count({
      where: {
        answer: { student: { assignmentId: id } },
        ...(sinceDate && !isNaN(sinceDate.getTime())
          ? { gradedAt: { gte: sinceDate } }
          : {}),
      },
    });

    return NextResponse.json({
      graded,
      total,
      serverTime: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json({ error: toErrorMessage(err) }, { status: 500 });
  }
}
