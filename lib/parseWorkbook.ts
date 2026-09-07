import * as XLSX from "xlsx";

export type ParsedQuestion = {
  index: number;
  header: string;
};

export type ParsedStudent = {
  index: number;
  name: string;
  answers: string[]; // aligned with ParsedQuestion order
};

export type ParsedWorkbook = {
  questions: ParsedQuestion[];
  students: ParsedStudent[];
};

/**
 * Expects a sheet with a "Name" (or similar) first column followed by one
 * column per question. Every non-empty column after the name column is
 * treated as a question; every non-empty row after the header is a student.
 */
export function parseWorkbook(buffer: ArrayBuffer | Buffer): ParsedWorkbook {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("Workbook contains no sheets.");
  const sheet = workbook.Sheets[sheetName];

  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    blankrows: false,
    defval: "",
  });

  if (rows.length === 0) throw new Error("Sheet is empty.");

  const headerRow = rows[0].map((c) => String(c ?? "").trim());
  const nameColIndex = 0; // first column is the student's name

  const questions: ParsedQuestion[] = [];
  for (let col = 0; col < headerRow.length; col++) {
    if (col === nameColIndex) continue;
    const header = headerRow[col];
    if (!header) continue;
    questions.push({ index: questions.length, header });
  }

  if (questions.length === 0) {
    throw new Error(
      "No question columns detected. Expected a header row with a name column followed by one column per question."
    );
  }

  const questionColumns = headerRow
    .map((h, col) => ({ h, col }))
    .filter(({ h, col }) => col !== nameColIndex && h);

  const students: ParsedStudent[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const name = String(row[nameColIndex] ?? "").trim();
    if (!name) continue;
    const answers = questionColumns.map(({ col }) =>
      String(row[col] ?? "").trim()
    );
    students.push({ index: students.length, name, answers });
  }

  if (students.length === 0) {
    throw new Error("No student rows detected below the header row.");
  }

  return { questions, students };
}
