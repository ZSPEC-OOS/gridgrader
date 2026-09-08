import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { extractStudentFromImage } from "@/lib/extraction";
import { toErrorMessage } from "@/lib/apiError";

// One image per request, called repeatedly by the client for each PNG in
// the uploaded ZIP — keeps every request well within a serverless
// function's timeout regardless of how many screenshots are in a batch,
// the same reasoning behind the grade endpoint's per-batch design.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing image file." }, { status: 400 });
  }

  let settings;
  try {
    settings = await prisma.settings.findUnique({ where: { id: 1 } });
    if (!settings?.apiKey) {
      return NextResponse.json(
        { error: "No AI model configured. Add an API key on the Settings page first." },
        { status: 400 }
      );
    }
  } catch (err) {
    return NextResponse.json({ error: toErrorMessage(err) }, { status: 500 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await extractStudentFromImage({
      apiKey: settings.apiKey!,
      baseUrl: settings.baseUrl,
      model: settings.model,
      useMaxCompletionTokens: settings.useMaxCompletionTokens,
      imageBase64: buffer.toString("base64"),
      // This endpoint only ever accepts .png uploads, so normalize any
      // non-image content type (e.g. a browser sending an untyped Blob as
      // "application/octet-stream" over the wire) to image/png rather than
      // passing it through to the vision API, which rejects anything else.
      mimeType: file.type.startsWith("image/") ? file.type : "image/png",
    });

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: toErrorMessage(err) }, { status: 500 });
  }
}
