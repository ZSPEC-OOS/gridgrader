import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { toErrorMessage } from "@/lib/apiError";

const SETTINGS_ID = 1;

export async function GET() {
  try {
    const settings = await prisma.settings.findUnique({
      where: { id: SETTINGS_ID },
    });

    if (!settings) {
      return NextResponse.json({
        provider: "openai",
        model: "gpt-4o-mini",
        hasApiKey: false,
        apiKeyPreview: null,
        savedModels: [],
      });
    }

    return NextResponse.json({
      provider: settings.provider,
      model: settings.model,
      hasApiKey: Boolean(settings.apiKey),
      apiKeyPreview: settings.apiKey
        ? `sk-...${settings.apiKey.slice(-4)}`
        : null,
      savedModels: settings.savedModels,
    });
  } catch (err) {
    return NextResponse.json({ error: toErrorMessage(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const provider = typeof body.provider === "string" ? body.provider : "openai";
  const model = typeof body.model === "string" && body.model.trim()
    ? body.model.trim()
    : "gpt-4o-mini";
  const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";

  try {
    const existing = await prisma.settings.findUnique({
      where: { id: SETTINGS_ID },
    });

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
        savedModels,
      },
      update: {
        provider,
        model,
        // Only overwrite the stored key if a new one was actually submitted,
        // so re-saving the model choice doesn't clobber the existing key.
        apiKey: apiKey ? apiKey : existing?.apiKey,
        savedModels,
      },
    });

    return NextResponse.json({
      provider: settings.provider,
      model: settings.model,
      hasApiKey: Boolean(settings.apiKey),
      apiKeyPreview: settings.apiKey
        ? `sk-...${settings.apiKey.slice(-4)}`
        : null,
      savedModels: settings.savedModels,
    });
  } catch (err) {
    return NextResponse.json({ error: toErrorMessage(err) }, { status: 500 });
  }
}
