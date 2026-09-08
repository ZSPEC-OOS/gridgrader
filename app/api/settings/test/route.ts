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

    // Mirror the actual grading call as closely as possible — same
    // response_format, same reasoning-model token-field handling, and a
    // token budget generous enough for a reasoning model's internal
    // reasoning tokens to not crowd out the visible reply — so a passing
    // test is a reliable predictor that grading itself will work, not
    // just that the API key is valid.
    const reasoningModelFields = settings.useMaxCompletionTokens
      ? { max_completion_tokens: 1500 }
      : { max_tokens: 20, temperature: 0 };

    const response = await client.chat.completions.create({
      model: settings.model,
      messages: [
        {
          role: "system",
          content:
            'Respond with a single JSON object of the form {"status": "OK"}.',
        },
        { role: "user", content: "Confirm the connection is working." },
      ],
      response_format: { type: "json_object" },
      ...reasoningModelFields,
    });

    const raw = response.choices[0]?.message?.content?.trim();

    if (!raw) {
      return NextResponse.json({
        ok: false,
        model: settings.model,
        error:
          "The model returned an empty response. If this is a reasoning model, its internal reasoning may be consuming the entire token budget before producing any visible output — try a different model.",
      });
    }

    // Prefer showing just the status text when the reply parses as the
    // requested JSON shape; fall back to the raw reply for a provider that
    // ignored response_format and replied in prose — either way this
    // confirms the connection actually produced a usable response.
    let reply = raw;
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed.status === "string") reply = parsed.status;
    } catch {
      // not JSON — show the raw reply as-is
    }

    return NextResponse.json({ ok: true, model: settings.model, reply });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: toErrorMessage(err) },
      { status: 200 }
    );
  }
}
