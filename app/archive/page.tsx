"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { parseJsonResponse } from "@/lib/apiClient";

type ArchivedAssignment = {
  id: string;
  name: string;
  studentCount: number;
  questionCount: number;
  gradedAt: string | null;
  archivedAt: string;
};

export default function ArchivePage() {
  const [assignments, setAssignments] = useState<ArchivedAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/assignments?archived=true");
      setAssignments(await parseJsonResponse<ArchivedAssignment[]>(res));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load archived assignments."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount
    load();
  }, [load]);

  async function handleRestore(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/assignments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: false }),
      });
      await parseJsonResponse<{ ok: boolean }>(res);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to restore.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This can't be undone.`)) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/assignments/${id}`, { method: "DELETE" });
      await parseJsonResponse<{ ok: boolean }>(res);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Archive</h1>
      <p className="mt-1 text-sm text-neutral-600 dark:text-muted">
        Assignments you&rsquo;ve set aside. Their grades are kept; restore one to
        move it back to Grading.
      </p>

      <div className="mt-4 overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-border dark:bg-surface">
        {loading ? (
          <p className="p-6 text-sm text-neutral-500 dark:text-muted">Loading…</p>
        ) : error ? (
          <p className="p-6 text-sm text-red-600">{error}</p>
        ) : assignments.length === 0 ? (
          <p className="p-6 text-sm text-neutral-500 dark:text-muted">
            Nothing archived yet.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500 dark:bg-surface-muted dark:text-muted">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Students</th>
                <th className="px-4 py-3">Questions</th>
                <th className="px-4 py-3">Archived</th>
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
                    {new Date(a.archivedAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {a.gradedAt && (
                        <Link
                          href={`/assignments/${a.id}/grid`}
                          className="rounded bg-brand-ink px-4 py-1.5 text-xs font-medium text-white hover:bg-brand-maroon dark:bg-brand-crimson dark:hover:opacity-90"
                        >
                          View grid
                        </Link>
                      )}
                      <button
                        onClick={() => handleRestore(a.id)}
                        disabled={busyId === a.id}
                        className="rounded border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:border-brand-maroon hover:text-brand-maroon disabled:opacity-50 dark:border-border dark:text-foreground dark:hover:border-brand-crimson dark:hover:text-brand-crimson"
                      >
                        Restore
                      </button>
                      <button
                        onClick={() => handleDelete(a.id, a.name)}
                        disabled={busyId === a.id}
                        className="rounded border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:border-red-500 hover:bg-red-50 disabled:opacity-50 dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-500/10"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
