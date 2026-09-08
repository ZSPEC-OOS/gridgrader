"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { parseJsonResponse } from "@/lib/apiClient";

type Question = {
  id: string;
  index: number;
  header: string;
  criteria: string | null;
  maxScore: number;
};

type AssignmentDetail = {
  id: string;
  name: string;
  questions: Question[];
};

export default function EditAssignmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [name, setName] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setLoadFailed(false);
    setError(null);
    try {
      const res = await fetch(`/api/assignments/${id}`);
      const data = await parseJsonResponse<AssignmentDetail>(res);
      setName(data.name);
      setQuestions(data.questions);
    } catch (err) {
      setLoadFailed(true);
      setError(
        err instanceof Error ? err.message : "Failed to load assignment."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function updateQuestion(qid: string, patch: Partial<Question>) {
    setQuestions((prev) =>
      prev.map((q) => (q.id === qid ? { ...q, ...patch } : q))
    );
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/assignments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          questions: questions.map((q) => ({
            id: q.id,
            criteria: q.criteria ?? "",
            maxScore: q.maxScore,
          })),
        }),
      });
      await parseJsonResponse(res);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10">
        <p className="text-sm text-neutral-500 dark:text-muted">Loading…</p>
      </div>
    );
  }

  if (loadFailed) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Edit assignment</h1>
        <div className="mt-6 rounded-lg border border-neutral-200 bg-white p-6 dark:border-border dark:bg-surface">
          <p className="text-sm text-red-600">{error}</p>
          <button
            onClick={load}
            className="mt-4 rounded bg-brand-ink px-4 py-2 text-sm font-medium text-white hover:bg-brand-maroon dark:bg-brand-crimson dark:hover:opacity-90"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Edit assignment</h1>
        <Link
          href="/"
          className="text-sm text-neutral-600 hover:text-brand-maroon dark:text-muted dark:hover:text-brand-crimson"
        >
          ← Back to Grading
        </Link>
      </div>
      <p className="mt-1 text-sm text-neutral-600 dark:text-muted">
        Update the grading criteria or point values. If this assignment was
        already graded, saving marks it ready to grade again so the new
        criteria actually get applied.
      </p>

      <div className="mt-6 rounded-lg border border-neutral-200 bg-white p-6 dark:border-border dark:bg-surface">
        <div>
          <label className="block text-xs font-medium text-neutral-500 dark:text-muted">
            Assignment name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 dark:border-border dark:bg-surface-muted dark:text-foreground"
          />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {questions.map((q) => (
            <div
              key={q.id}
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
                      updateQuestion(q.id, {
                        maxScore: Number(e.target.value) || 1,
                      })
                    }
                    className="w-16 rounded border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-900 dark:border-border dark:bg-surface-muted dark:text-foreground"
                  />
                </label>
              </div>
              <textarea
                value={q.criteria ?? ""}
                onChange={(e) =>
                  updateQuestion(q.id, { criteria: e.target.value })
                }
                placeholder="Paste the grading criteria / answer key for this question..."
                rows={5}
                className="mt-2 w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 dark:border-border dark:bg-surface-muted dark:text-foreground dark:placeholder:text-muted"
              />
            </div>
          ))}
        </div>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        <div className="mt-6 flex justify-end gap-3">
          <Link
            href="/"
            className="rounded px-5 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 dark:text-muted dark:hover:text-foreground"
          >
            Cancel
          </Link>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded bg-brand-ink px-5 py-2 text-sm font-medium text-white hover:bg-brand-maroon disabled:opacity-50 dark:bg-brand-crimson dark:hover:opacity-90"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
