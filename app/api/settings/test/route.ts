import { NextResponse } from "next/server";
import OpenAI from "openai";
import { prisma } from "@/lib/db";
import { toErrorMessage } from "@/lib/apiError";

export async function POST() {
  try {
    const settings = await prisma.settings.findUnique({ where: { id: 1 } });

    if (!settings?.apiKey) {
      return NextResponse.json({ ok: false, error: "No API key saved yet." });
    }

    const client = new OpenAI({
      apiKey: settings.apiKey,
      baseURL: settings.baseUrl || undefined,
    });

    const tokenLimitField = settings.useMaxCompletionTokens
      ? { max_completion_tokens: 5 }
      : { max_tokens: 5 };

    const response = await client.chat.completions.create({
      model: settings.model,
      messages: [{ role: "user", content: "Reply with exactly: OK" }],
      ...tokenLimitField,
    });

    const reply = response.choices[0]?.message?.content?.trim() || "(empty response)";

    return NextResponse.json({ ok: true, model: settings.model, reply });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: toErrorMessage(err) },
      { status: 200 }
    );
  }
}
