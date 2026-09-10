import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { toErrorMessage } from "@/lib/apiError";
import { hashPin } from "@/lib/pin";
import {
  DEFAULT_GRADING_STRICTNESS_LEVEL,
  isGradingStrictnessLevel,
} from "@/lib/gradingStrictness";

const SETTINGS_ID = 1;
const MIN_PIN_LENGTH = 4;
const KNOWN_PROVIDERS = new Set(["openai", "deepseek"]);

export async function GET() {
  try {
    const settings = await prisma.settings.findUnique({
      where: { id: SETTINGS_ID },
    });

    if (!settings) {
      return NextResponse.json({
        provider: "openai",
        model: "gpt-4o-mini",
        baseUrl: null,
        hasApiKey: false,
        apiKeyPreview: null,
        savedModels: [],
        hasPin: false,
        useMaxCompletionTokens: false,
        gradingStrictnessLevel: DEFAULT_GRADING_STRICTNESS_LEVEL,
      });
    }

    return NextResponse.json({
      provider: settings.provider,
      model: settings.model,
      baseUrl: settings.baseUrl,
      hasApiKey: Boolean(settings.apiKey),
      apiKeyPreview: settings.apiKey
        ? `sk-...${settings.apiKey.slice(-4)}`
        : null,
      savedModels: settings.savedModels,
      hasPin: Boolean(settings.pinHash),
      useMaxCompletionTokens: settings.useMaxCompletionTokens,
      gradingStrictnessLevel: settings.gradingStrictnessLevel,
    });
  } catch (err) {
    return NextResponse.json({ error: toErrorMessage(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const provider =
    typeof body.provider === "string" && KNOWN_PROVIDERS.has(body.provider)
      ? body.provider
      : "openai";
  const model = typeof body.model === "string" && body.model.trim()
    ? body.model.trim()
    : "gpt-4o-mini";
  const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
  const baseUrlInput =
    typeof body.baseUrl === "string" ? body.baseUrl.trim() : "";
  const newPin = typeof body.newPin === "string" ? body.newPin.trim() : "";
  const useMaxCompletionTokens = Boolean(body.useMaxCompletionTokens);

  if (baseUrlInput) {
    try {
      new URL(baseUrlInput);
    } catch {
      return NextResponse.json(
        { error: "Base URL is not a valid URL." },
        { status: 400 }
      );
    }
  }

  // Missing entirely defaults to Balanced; a present-but-invalid value
  // (fractional, out of range, wrong type) is rejected outright rather
  // than silently normalized.
  const gradingStrictnessLevel =
    body.gradingStrictnessLevel === undefined
      ? DEFAULT_GRADING_STRICTNESS_LEVEL
      : isGradingStrictnessLevel(body.gradingStrictnessLevel)
        ? body.gradingStrictnessLevel
        : null;

  if (gradingStrictnessLevel === null) {
    return NextResponse.json(
      { error: "Grading strictness must be a whole number from 1 to 5." },
      { status: 400 }
    );
  }

  try {
    const existing = await prisma.settings.findUnique({
      where: { id: SETTINGS_ID },
    });

    // A PIN is only ever created once, on the first save, and never
    // overwritten by this endpoint afterwards — changing it isn't
    // supported yet.
    let pinHash = existing?.pinHash ?? null;
    if (!pinHash) {
      if (newPin.length < MIN_PIN_LENGTH) {
        return NextResponse.json(
          { error: `Choose a PIN of at least ${MIN_PIN_LENGTH} digits.` },
          { status: 400 }
        );
      }
      pinHash = hashPin(newPin);
    }

    const savedModels = Array.from(
      new Set([...(existing?.savedModels ?? []), model])
    );

    const settings = await prisma.settings.upsert({
      where: { id: SETTINGS_ID },
      create: {
        id: SETTINGS_ID,
        provider,
        model,
        apiKey: apiKey || null,
        baseUrl: baseUrlInput || null,
        savedModels,
        pinHash,
        useMaxCompletionTokens,
        gradingStrictnessLevel,
      },
      update: {
        provider,
        model,
        // Only overwrite the stored key if a new one was actually submitted,
        // so re-saving the model choice doesn't clobber the existing key.
        apiKey: apiKey ? apiKey : existing?.apiKey,
        baseUrl: baseUrlInput || null,
        savedModels,
        pinHash,
        useMaxCompletionTokens,
        gradingStrictnessLevel,
      },
    });

    return NextResponse.json({
      provider: settings.provider,
      model: settings.model,
      baseUrl: settings.baseUrl,
      hasApiKey: Boolean(settings.apiKey),
      apiKeyPreview: settings.apiKey
        ? `sk-...${settings.apiKey.slice(-4)}`
        : null,
      savedModels: settings.savedModels,
      hasPin: Boolean(settings.pinHash),
      useMaxCompletionTokens: settings.useMaxCompletionTokens,
      gradingStrictnessLevel: settings.gradingStrictnessLevel,
    });
  } catch (err) {
    return NextResponse.json({ error: toErrorMessage(err) }, { status: 500 });
  }
}
