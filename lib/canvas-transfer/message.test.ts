import { describe, expect, it } from "vitest";
import {
  CANVAS_EXPORT_MESSAGE_SOURCE,
  CANVAS_EXPORT_MESSAGE_TYPE,
  createCanvasExportMessage,
} from "./message";
import { validateCanvasTransferPackage, type CanvasTransferPackageV1 } from "./schema";

const pkg: CanvasTransferPackageV1 = validateCanvasTransferPackage({
  schema: "gridgrader.canvas-transfer",
  version: 1,
  exportedAt: new Date().toISOString(),
  assignment: { id: "a1", name: "Test" },
  questions: [{ id: "q1", index: 0, header: "Q1", maxScore: 10 }],
  students: [
    {
      id: "s1",
      name: "Alice",
      answers: [{ answerId: "a1", questionId: "q1", questionIndex: 0, score: 5, maxScore: 10 }],
    },
  ],
});

describe("createCanvasExportMessage", () => {
  it("has the exact source, type, schema, and version the extension expects", () => {
    const message = createCanvasExportMessage(pkg);

    expect(message.source).toBe("gridgrader-web");
    expect(message.type).toBe("GRIDGRADER_CANVAS_EXPORT");
    expect(message.payload.schema).toBe("gridgrader.canvas-transfer");
    expect(message.payload.version).toBe(1);
  });

  it("uses the same exported constants for source and type", () => {
    const message = createCanvasExportMessage(pkg);
    expect(message.source).toBe(CANVAS_EXPORT_MESSAGE_SOURCE);
    expect(message.type).toBe(CANVAS_EXPORT_MESSAGE_TYPE);
  });

  it("carries the package through unchanged", () => {
    const message = createCanvasExportMessage(pkg);
    expect(message.payload).toBe(pkg);
  });
});
