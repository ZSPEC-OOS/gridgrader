import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const { findFirst, upsert } = vi.hoisted(() => ({ findFirst: vi.fn(), upsert: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { answer: { findFirst }, grade: { upsert } } }));
import { PATCH } from "./route";
const params = { params: Promise.resolve({ id: "assignment" }) };
function request(score: unknown) {
  return new NextRequest("http://localhost/api/assignments/assignment/grade", {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answerId: "answer", score }),
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  findFirst.mockResolvedValue({ question: { maxScore: 1.5, criteria: "Correct answer is X." } });
  upsert.mockImplementation(({ create }) => Promise.resolve(create));
});
describe("manual score enforcement", () => {
  it.each([0, 1.5])("accepts endpoint %s", async (score) => {
    const response = await PATCH(request(score), params);
    expect(response.status).toBe(200);
    expect((await response.json()).score).toBe(score);
    expect(upsert.mock.calls[0][0].create.maxScore).toBe(1.5);
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "answer", student: { assignmentId: "assignment" } } }));
  });
  it.each([0.5, 0.75, 1, -1, 2, null, false, "0", "", []])("rejects unauthorized or nonnumeric %s without persisting", async (score) => {
    expect((await PATCH(request(score), params)).status).toBe(400);
    expect(upsert).not.toHaveBeenCalled();
  });
  it.each([0, 0.5, 1, 1.5])("accepts authorized component score %s", async (score) => {
    findFirst.mockResolvedValue({ question: { maxScore: 1.5, criteria: "1 point for X; 0.5 points for Y" } });
    const response = await PATCH(request(score), params);
    expect(response.status).toBe(200);
    expect((await response.json()).score).toBe(score);
  });
  it("does not accept 0.75 with vague partial credit language", async () => {
    findFirst.mockResolvedValue({ question: { maxScore: 1.5, criteria: "Partial credit allowed" } });
    expect((await PATCH(request(0.75), params)).status).toBe(400);
    expect(upsert).not.toHaveBeenCalled();
  });
  it("returns 404 for an answer outside the selected assignment", async () => {
    findFirst.mockResolvedValue(null);
    expect((await PATCH(request(0), params)).status).toBe(404);
    expect(upsert).not.toHaveBeenCalled();
  });
  it("preserves integer grades authorized by an integer rubric", async () => {
    findFirst.mockResolvedValue({ question: { maxScore: 10, criteria: "1 point for each of ten required elements" } });
    expect((await PATCH(request(8), params)).status).toBe(200);
    expect(upsert.mock.calls[0][0].create.score).toBe(8);
  });
});
