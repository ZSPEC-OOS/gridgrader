"use client";

import { useRef, useState } from "react";
import JSZip from "jszip";
import ExcelJS from "exceljs";
import { mapWithConcurrency } from "@/lib/concurrency";

type ExtractedAnswer = { question: number; answer: string };
type ExtractedStudent = { name: string | null; answers: ExtractedAnswer[] };

type Progress = { done: number; total: number };
type Failure = { imageName: string; error: string };

const CONCURRENCY = 4;

export default function GradingPrepPage() {
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [compiling, setCompiling] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [failures, setFailures] = useState<Failure[]>([]);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadName, setDownloadName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) chooseFile(dropped);
  }

  function chooseFile(f: File) {
    if (!/\.zip$/i.test(f.name)) {
      setFatalError("Please choose a .zip file.");
      return;
    }
    setFile(f);
    setFatalError(null);
    setFailures([]);
    setDownloadUrl(null);
    setDownloadName(null);
  }

  async function handleCompile() {
    if (!file) return;
    setCompiling(true);
    setFatalError(null);
    setFailures([]);
    setDownloadUrl(null);
    setDownloadName(null);
    setProgress(null);

    try {
      const zip = await JSZip.loadAsync(file);
      // Process in the order the images appear in the ZIP.
      const entries = Object.values(zip.files).filter(
        (entry) => !entry.dir && /\.png$/i.test(entry.name)
      );

      if (entries.length === 0) {
        throw new Error("No PNG images found in that ZIP.");
      }

      setProgress({ done: 0, total: entries.length });
      let doneCount = 0;
      const newFailures: Failure[] = [];

      const results = await mapWithConcurrency(entries, CONCURRENCY, async (entry) => {
        try {
          // JSZip's extracted blobs carry no MIME type; an untyped Blob
          // becomes "application/octet-stream" on the wire once sent
          // through FormData (per the Fetch spec), which the vision API
          // then rejects outright. Since this endpoint only ever accepts
          // .png entries, force the correct type explicitly.
          const rawBlob = await entry.async("blob");
          const blob = new Blob([rawBlob], { type: "image/png" });
          const form = new FormData();
          form.append("file", blob, entry.name);
          const res = await fetch("/api/grading-prep/extract", {
            method: "POST",
            body: form,
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? "Extraction failed.");
          return data as ExtractedStudent;
        } catch (err) {
          newFailures.push({
            imageName: entry.name,
            error: err instanceof Error ? err.message : "Extraction failed.",
          });
          return null;
        } finally {
          doneCount += 1;
          setProgress({ done: doneCount, total: entries.length });
        }
      });

      setFailures(newFailures);

      // Group by student name (case/whitespace-insensitively, in case a
      // student's submission spans more than one screenshot), preserving
      // the order each name first appears in the ZIP. Later screenshots'
      // answers win over earlier ones for the same question number.
      const order: string[] = [];
      const byNameKey = new Map<
        string,
        { name: string; answers: Map<number, string> }
      >();

      for (const student of results) {
        if (!student) continue;
        const displayName = student.name?.trim() || "(unknown)";
        const key = displayName.toLowerCase();
        if (!byNameKey.has(key)) {
          byNameKey.set(key, { name: displayName, answers: new Map() });
          order.push(key);
        }
        const entryForStudent = byNameKey.get(key)!;
        for (const a of student.answers) {
          entryForStudent.answers.set(a.question, a.answer || "[No answer]");
        }
      }

      const students = order.map((key) => byNameKey.get(key)!);

      if (students.length === 0) {
        throw new Error(
          "No student data could be extracted from any image — nothing to compile."
        );
      }

      const maxQuestion = Math.max(
        1,
        ...students.flatMap((s) => Array.from(s.answers.keys()))
      );

      await buildWorkbook(students, maxQuestion, file.name);
    } catch (err) {
      setFatalError(err instanceof Error ? err.message : "Compile failed.");
    } finally {
      setCompiling(false);
    }
  }

  async function buildWorkbook(
    students: { name: string; answers: Map<number, string> }[],
    maxQuestion: number,
    sourceFileName: string
  ) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Responses", {
      views: [{ state: "frozen", ySplit: 1 }],
    });

    const headers = ["Name", ...Array.from({ length: maxQuestion }, (_, i) => `Question ${i + 1}`)];
    sheet.columns = headers.map((header, i) => ({
      header,
      key: `col${i}`,
      width: i === 0 ? 24 : 50,
    }));
    sheet.getRow(1).font = { bold: true };

    for (const student of students) {
      const row = sheet.addRow([
        student.name,
        ...Array.from({ length: maxQuestion }, (_, i) => student.answers.get(i + 1) ?? "[No answer]"),
      ]);
      row.eachCell((cell) => {
        cell.alignment = { wrapText: true, vertical: "top" };
      });
    }

    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: headers.length },
    };

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const name = sourceFileName.replace(/\.zip$/i, "") + "-responses.xlsx";
    setDownloadUrl(url);
    setDownloadName(name);

    // Trigger the download automatically; the link below stays as a
    // manual fallback in case a browser blocks the auto-click.
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10 space-y-8">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight">Grading Prep</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-muted">
          Drop a ZIP of student assignment/reflection screenshots (PNG). Each
          image is processed into one row of a spreadsheet — one column per
          question — that you can then upload on the Grading page.
        </p>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`mt-4 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-14 text-center transition ${
            dragActive
              ? "border-brand-crimson bg-brand-crimson/5"
              : "border-neutral-300 bg-white hover:border-neutral-400 dark:border-border dark:bg-surface dark:hover:border-muted"
          }`}
        >
          <p className="text-sm font-medium text-neutral-700 dark:text-foreground">
            {file
              ? file.name
              : "Drag & drop a .zip file here, or click to choose one"}
          </p>
          <p className="mt-1 text-xs text-neutral-500 dark:text-muted">
            One PNG screenshot per student submission
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) chooseFile(f);
            }}
          />
        </div>

        {fatalError && <p className="mt-3 text-sm text-red-600">{fatalError}</p>}

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleCompile}
            disabled={!file || compiling}
            className="rounded bg-brand-ink px-5 py-2 text-sm font-medium text-white hover:bg-brand-maroon disabled:opacity-50 dark:bg-brand-crimson dark:hover:opacity-90"
          >
            {compiling ? "Compiling…" : "Compile"}
          </button>
        </div>

        {downloadUrl && downloadName && (
          <p className="mt-4 text-sm text-green-600 dark:text-green-400">
            Done —{" "}
            <a href={downloadUrl} download={downloadName} className="underline">
              download {downloadName}
            </a>{" "}
            if it didn&apos;t start automatically.
          </p>
        )}

        {failures.length > 0 && (
          <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
            <p className="font-medium">
              {failures.length} image{failures.length === 1 ? "" : "s"} couldn&apos;t
              be processed and {failures.length === 1 ? "was" : "were"} skipped:
            </p>
            <ul className="mt-1 list-disc pl-5">
              {failures.slice(0, 10).map((f, i) => (
                <li key={i}>
                  {f.imageName}: {f.error}
                </li>
              ))}
              {failures.length > 10 && <li>…and {failures.length - 10} more</li>}
            </ul>
          </div>
        )}
      </section>

      {progress && compiling && <ProgressModal progress={progress} />}
    </div>
  );
}

function ProgressModal({ progress }: { progress: Progress }) {
  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-lg border border-neutral-200 bg-white p-6 shadow-lg dark:border-border dark:bg-surface">
        <h3 className="text-base font-semibold text-neutral-900 dark:text-foreground">
          Compiling screenshots
        </h3>
        <p className="mt-1 text-sm text-neutral-600 dark:text-muted">
          {progress.done} of {progress.total} images processed…
        </p>

        <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-surface-muted">
          <div
            className="h-full rounded-full bg-brand-crimson transition-all duration-300 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="mt-2 text-xs text-neutral-500 dark:text-muted">{pct}%</div>
      </div>
    </div>
  );
}
