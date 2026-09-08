import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { toErrorMessage } from "@/lib/apiError";
import { verifyPin } from "@/lib/pin";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const pin = typeof body.pin === "string" ? body.pin.trim() : "";

  try {
    const settings = await prisma.settings.findUnique({ where: { id: 1 } });

    if (!settings?.pinHash) {
      // Nothing to unlock.
      return NextResponse.json({ valid: true });
    }

    return NextResponse.json({ valid: verifyPin(pin, settings.pinHash) });
  } catch (err) {
    return NextResponse.json({ error: toErrorMessage(err) }, { status: 500 });
  }
}
