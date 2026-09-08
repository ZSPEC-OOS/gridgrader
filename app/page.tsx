"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { parseJsonResponse } from "@/lib/apiClient";

type AssignmentSummary = {
  id: string;
  name: string;
  status: "CRITERIA_PENDING" | "READY_TO_GRADE" | "GRADING" | "GRADED";
  studentCount: number;
  questionCount: number;
  createdAt: string;
  gradedAt: string | null;
};

type DraftQuestion = {
  header: string;
  criteria: string;
  maxScore: number;
};

const STATUS_LABEL: Record<AssignmentSummary["status"], string> = {
  CRITERIA_PENDING: "Criteria needed",
  READY_TO_GRADE: "Ready to grade",
  GRADING: "Grading…",
  GRADED: "Graded",
};

const STATUS_CLASS: Record<AssignmentSummary["status"], string> = {
  CRITERIA_PENDING: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  READY_TO_GRADE: "bg-brand-crimson/10 text-brand-crimson",
  GRADING: "bg-brand-crimson/10 text-brand-crimson animate-pulse",
  GRADED: "bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300",
};

export default function HomePage() {
  const router = useRouter();
  const [assignments, setAssignments] = useState<AssignmentSummary[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  const [file, setFile] = useState<File | null>(null);
  const [assignmentName, setAssignmentName] = useState("");
  const [draftQuestions, setDraftQuestions] = useState<DraftQuestion[] | null>(
    null
  );
  const [parseError, setParseError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [gradingId, setGradingId] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadAssignments = useCallback(async () => {
    setLoadingList(true);
    setListError(null);
    try {
      const res = await fetch("/api/assignments");
      const data = await parseJsonResponse<AssignmentSummary[]>(res);
      setAssignments(data);
    } catch (err) {
      setListError(
        err instanceof Error ? err.message : "Failed to load assignments."
      );
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount
    loadAssignments();
  }, [loadAssignments]);

  async function handleFile(selected: File) {
    setParseError(null);
    setSaveError(null);
    setFile(selected);
    setAssignmentName(selected.name.replace(/\.[^.]+$/, ""));

    try {
      const XLSX = await import("xlsx");
      const buffer = await selected.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        blankrows: false,
        defval: "",
      });

      if (rows.length === 0) throw new Error("The sheet is empty.");

      const headerRow = (rows[0] as unknown[]).map((c) =>
        String(c ?? "").trim()
      );
      const headers = headerRow.filter((h, i) => i > 0 && h);

      if (headers.length === 0) {
        throw new Error(
          "Couldn't find any question columns. Expected a name column followed by one column per question."
        );
      }

      setDraftQuestions(
        headers.map((header) => ({ header, criteria: "", maxScore: 10 }))
      );
    } catch (err) {
      setDraftQuestions(null);
      setParseError(
        err instanceof Error ? err.message : "Failed to read that file."
      );
    }
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) handleFile(dropped);
  }

  function updateDraft(i: number, patch: Partial<DraftQuestion>) {
    setDraftQuestions((prev) =>
      prev
        ? prev.map((q, idx) => (idx === i ? { ...q, ...patch } : q))
        : prev
    );
  }

  function resetUpload() {
    setFile(null);
    setDraftQuestions(null);
    setParseError(null);
    setSaveError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSave() {
    if (!file || !draftQuestions) return;
    setSaving(true);
    setSaveError(null);

    const form = new FormData();
    form.append("file", file);
    form.append("name", assignmentName);
    form.append(
      "criteria",
      JSON.stringify(
        draftQuestions.map((q) => ({
          header: q.header,
          criteria: q.criteria,
          maxScore: q.maxScore,
        }))
      )
    );

    try {
      const res = await fetch("/api/assignments", {
        method: "POST",
        body: form,
      });
      await parseJsonResponse<{ id: string }>(res);
      resetUpload();
      await loadAssignments();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  async function handleGrade(id: string) {
    setGradingId(id);
    try {
      const res = await fetch(`/api/assignments/${id}/grade`, {
        method: "POST",
      });
      const data = await parseJsonResponse<{
        graded: number;
        total: number;
        errors: string[];
      }>(res);
      await loadAssignments();

      if (data.errors.length > 0) {
        const preview = data.errors.slice(0, 5).join("\n");
        const more =
          data.errors.length > 5
            ? `\n…and ${data.errors.length - 5} more`
            : "";
        alert(
          `Graded ${data.graded} of ${data.total} answers. ${data.errors.length} failed:\n${preview}${more}`
        );
      }

      // Only jump to the grid if something actually got graded — otherwise
      // it's just a confusing wall of dashes.
      if (data.graded > 0) {
        router.push(`/assignments/${id}/grid`);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Grading failed.");
      await loadAssignments();
    } finally {
      setGradingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 space-y-10">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight">Grading</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-muted">
          Drop a spreadsheet of student responses to get started. The first
          column should hold student names, and each column after it is one
          question.
        </p>

        {!draftQuestions && (
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
              Drag & drop a .xlsx / .csv file here, or click to choose one
            </p>
            <p className="mt-1 text-xs text-neutral-500 dark:text-muted">
              Column A = student name, columns B+ = one per question
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </div>
        )}

        {parseError && (
          <p className="mt-3 text-sm text-red-600">{parseError}</p>
        )}

        {draftQuestions && (
          <div className="mt-6 rounded-lg border border-neutral-200 bg-white p-6 dark:border-border dark:bg-surface">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <label className="block text-xs font-medium text-neutral-500 dark:text-muted">
                  Assignment name
                </label>
                <input
                  value={assignmentName}
                  onChange={(e) => setAssignmentName(e.target.value)}
                  className="mt-1 w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 dark:border-border dark:bg-surface-muted dark:text-foreground"
                />
              </div>
              <button
                onClick={resetUpload}
                className="text-sm text-neutral-500 hover:text-neutral-800 dark:text-muted dark:hover:text-foreground"
              >
                Cancel
              </button>
            </div>

            <p className="mt-4 text-sm text-neutral-600 dark:text-muted">
              Found <strong>{draftQuestions.length}</strong> question
              {draftQuestions.length === 1 ? "" : "s"}. Paste grading
              criteria (the answer key / rubric) for each below.
            </p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {draftQuestions.map((q, i) => (
                <div
                  key={i}
                  className="rounded-md border border-neutral-200 p-4 dark:border-border"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-neutral-900 dark:text-foreground">
                      {q.header}
                    </span>
                    <label className="flex items-center gap-1 text-xs text-neutral-500 dark:text-muted">
                      Points
                      <input
                        type="number"
                        min={1}
                        value={q.maxScore}
                        onChange={(e) =>
                          updateDraft(i, {
                            maxScore: Number(e.target.value) || 1,
                          })
                        }
                        className="w-16 rounded border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-900 dark:border-border dark:bg-surface-muted dark:text-foreground"
                      />
                    </label>
                  </div>
                  <textarea
                    value={q.criteria}
                    onChange={(e) =>
                      updateDraft(i, { criteria: e.target.value })
                    }
                    placeholder="Paste the grading criteria / answer key for this question..."
                    rows={5}
                    className="mt-2 w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 dark:border-border dark:bg-surface-muted dark:text-foreground dark:placeholder:text-muted"
                  />
                </div>
              ))}
            </div>

            {saveError && (
              <p className="mt-4 text-sm text-red-600">{saveError}</p>
            )}

            <div className="mt-6 flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded bg-brand-ink px-5 py-2 text-sm font-medium text-white hover:bg-brand-maroon disabled:opacity-50 dark:bg-brand-crimson dark:hover:opacity-90"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold tracking-tight">Assignments</h2>
        <div className="mt-4 overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-border dark:bg-surface">
          {loadingList ? (
            <p className="p-6 text-sm text-neutral-500 dark:text-muted">Loading…</p>
          ) : listError ? (
            <p className="p-6 text-sm text-red-600">{listError}</p>
          ) : assignments.length === 0 ? (
            <p className="p-6 text-sm text-neutral-500 dark:text-muted">
              No assignments yet. Upload a file above to create one.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500 dark:bg-surface-muted dark:text-muted">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Students</th>
                  <th className="px-4 py-3">Questions</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="text-neutral-900 dark:text-foreground">
                {assignments.map((a) => (
                  <tr key={a.id} className="border-t border-neutral-100 dark:border-border">
                    <td className="px-4 py-3 font-medium">{a.name}</td>
                    <td className="px-4 py-3">{a.studentCount}</td>
                    <td className="px-4 py-3">{a.questionCount}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_CLASS[a.status]}`}
                      >
                        {STATUS_LABEL[a.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/assignments/${a.id}/edit`}
                          className="rounded border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:border-brand-maroon hover:text-brand-maroon dark:border-border dark:text-foreground dark:hover:border-brand-crimson dark:hover:text-brand-crimson"
                        >
                          Edit
                        </Link>
                        {a.gradedAt && (
                          <Link
                            href={`/assignments/${a.id}/grid`}
                            className="rounded bg-brand-ink px-4 py-1.5 text-xs font-medium text-white hover:bg-brand-maroon dark:bg-brand-crimson dark:hover:opacity-90"
                          >
                            View grid
                          </Link>
                        )}
                        <button
                          onClick={() => handleGrade(a.id)}
                          disabled={gradingId === a.id || a.status === "GRADING"}
                          className="rounded bg-brand-crimson px-4 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                        >
                          {gradingId === a.id || a.status === "GRADING"
                            ? "Grading…"
                            : a.gradedAt
                              ? "Re-grade"
                              : "Grade"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
