import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const SETTINGS_ID = 1;

export async function GET() {
  const settings = await prisma.settings.findUnique({
    where: { id: SETTINGS_ID },
  });

  if (!settings) {
    return NextResponse.json({
      provider: "openai",
      model: "gpt-4o-mini",
      hasApiKey: false,
      apiKeyPreview: null,
    });
  }

  return NextResponse.json({
    provider: settings.provider,
    model: settings.model,
    hasApiKey: Boolean(settings.apiKey),
    apiKeyPreview: settings.apiKey
      ? `sk-...${settings.apiKey.slice(-4)}`
      : null,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const provider = typeof body.provider === "string" ? body.provider : "openai";
  const model = typeof body.model === "string" && body.model.trim()
    ? body.model.trim()
    : "gpt-4o-mini";
  const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";

  const existing = await prisma.settings.findUnique({
    where: { id: SETTINGS_ID },
  });

  const settings = await prisma.settings.upsert({
    where: { id: SETTINGS_ID },
    create: {
      id: SETTINGS_ID,
      provider,
      model,
      apiKey: apiKey || null,
    },
    update: {
      provider,
      model,
      // Only overwrite the stored key if a new one was actually submitted,
      // so re-saving the model choice doesn't clobber the existing key.
      apiKey: apiKey ? apiKey : existing?.apiKey,
    },
  });

  return NextResponse.json({
    provider: settings.provider,
    model: settings.model,
    hasApiKey: Boolean(settings.apiKey),
    apiKeyPreview: settings.apiKey
      ? `sk-...${settings.apiKey.slice(-4)}`
      : null,
  });
}
