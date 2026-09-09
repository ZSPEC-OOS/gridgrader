import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { findUniqueMock, upsertMock } = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
  upsertMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    settings: {
      findUnique: findUniqueMock,
      upsert: upsertMock,
    },
  },
}));

// Imported after the mock so the route resolves to the mocked prisma client.
import { GET, POST } from "./route";

function postRequest(body: unknown) {
  return new NextRequest("http://localhost/api/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validBody = {
  provider: "openai",
  model: "gpt-4o-mini",
  baseUrl: "",
  useMaxCompletionTokens: false,
  apiKey: "",
  newPin: "1234",
};

beforeEach(() => {
  findUniqueMock.mockReset();
  upsertMock.mockReset();
});

describe("GET /api/settings", () => {
  it("defaults gradingStrictnessLevel to 3 when no settings row exists", async () => {
    findUniqueMock.mockResolvedValue(null);

    const res = await GET();
    const data = await res.json();

    expect(data.gradingStrictnessLevel).toBe(3);
  });

  it("echoes the persisted strictness level", async () => {
    findUniqueMock.mockResolvedValue({
      provider: "openai",
      model: "gpt-4o-mini",
      baseUrl: null,
      apiKey: null,
      savedModels: [],
      pinHash: null,
      useMaxCompletionTokens: false,
      gradingStrictnessLevel: 5,
    });

    const res = await GET();
    const data = await res.json();

    expect(data.gradingStrictnessLevel).toBe(5);
  });
});

describe("POST /api/settings validation", () => {
  beforeEach(() => {
    findUniqueMock.mockResolvedValue(null);
    upsertMock.mockImplementation(({ create }) => Promise.resolve(create));
  });

  it("accepts level 1", async () => {
    const res = await POST(postRequest({ ...validBody, gradingStrictnessLevel: 1 }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.gradingStrictnessLevel).toBe(1);
  });

  it("accepts level 5", async () => {
    const res = await POST(postRequest({ ...validBody, gradingStrictnessLevel: 5 }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.gradingStrictnessLevel).toBe(5);
  });

  it("defaults to level 3 when the field is omitted entirely", async () => {
    const res = await POST(postRequest(validBody));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.gradingStrictnessLevel).toBe(3);
  });

  it("rejects 0 with a clear error rather than silently normalizing", async () => {
    const res = await POST(postRequest({ ...validBody, gradingStrictnessLevel: 0 }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/1 to 5/);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("rejects 6 with a clear error", async () => {
    const res = await POST(postRequest({ ...validBody, gradingStrictnessLevel: 6 }));
    expect(res.status).toBe(400);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("rejects fractional levels like 2.5", async () => {
    const res = await POST(postRequest({ ...validBody, gradingStrictnessLevel: 2.5 }));
    expect(res.status).toBe(400);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("persists the chosen strictness level to the database", async () => {
    await POST(postRequest({ ...validBody, gradingStrictnessLevel: 4 }));

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ gradingStrictnessLevel: 4 }),
        update: expect.objectContaining({ gradingStrictnessLevel: 4 }),
      })
    );
  });

  it("no longer reads or writes gradingTolerancePercent", async () => {
    await POST(postRequest({ ...validBody, gradingStrictnessLevel: 3 }));

    const call = upsertMock.mock.calls[0][0];
    expect(call.create).not.toHaveProperty("gradingTolerancePercent");
    expect(call.update).not.toHaveProperty("gradingTolerancePercent");
  });
});
