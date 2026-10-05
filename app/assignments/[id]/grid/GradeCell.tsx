"use client";

import { useState } from "react";
import { formatScore, matchAllowedScore } from "@/lib/scoring";

export function GradeCell({
  score,
  maxScore,
  allowedScores,
  feedback,
  regradeMode,
  copyMode,
  editMode,
  regrading,
  saving,
  changedFrom,
  onRegrade,
  onManualEdit,
}: {
  score: number | null;
  maxScore: number;
  allowedScores: number[];
  feedback: string | null;
  regradeMode: boolean;
  copyMode: boolean;
  editMode: boolean;
  regrading: boolean;
  saving: boolean;
  // Set only when the most recent regrade actually changed this score —
  // holds the prior value so the indicator can say what it changed from.
  changedFrom: number | null;
  onRegrade: () => void;
  onManualEdit: (score: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  async function handleScoreClick() {
    if (editMode) {
      const current = score === null ? null : matchAllowedScore(score, allowedScores);
      setDraft(current === null ? "" : String(current));
      setEditing(true);
      return;
    }
    if (score === null) return;
    if (copyMode) {
      try {
        await navigator.clipboard.writeText(String(score));
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      } catch {
        // Clipboard access denied (e.g. insecure context) — nothing to do.
      }
    } else {
      setOpen((o) => !o);
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <select
          autoFocus
          value={draft}
          onChange={(e) => {
            const parsed = Number(e.target.value);
            setDraft(e.target.value);
            setEditing(false);
            onManualEdit(parsed);
          }}
          onBlur={() => setEditing(false)}
          disabled={saving}
          className="w-20 rounded border border-neutral-300 px-1.5 py-1 text-xs dark:border-border dark:bg-surface-muted dark:text-foreground"
        >
          <option value="" disabled>Choose score</option>
          {allowedScores.map((allowed) => (
            <option key={allowed} value={allowed}>
              {formatScore(allowed)}
            </option>
          ))}
        </select>
        <span className="text-xs text-neutral-400 dark:text-muted">
          / {formatScore(maxScore)}
        </span>
      </div>
    );
  }

  const pct = score !== null && maxScore > 0 ? score / maxScore : 0;
  const colorClass =
    score === null
      ? "bg-neutral-100 text-neutral-400 dark:bg-surface-muted dark:text-muted"
      : pct >= 0.8
        ? "bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300"
        : pct >= 0.6
          ? "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"
          : "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300";

  return (
    <div className="relative flex items-center gap-1">
      <div className="relative">
        <button
          onClick={handleScoreClick}
          disabled={saving || (score === null && !editMode)}
          title={
            changedFrom !== null
              ? `Changed by regrade: ${formatScore(changedFrom)} → ${score === null ? "—" : formatScore(score)}`
              : editMode
                ? `Click to set this score manually. Allowed: ${allowedScores.map(formatScore).join(", ")}`
                : copyMode && score !== null
                  ? "Click to copy"
                  : undefined
          }
          className={`w-full rounded px-2 py-1 text-xs font-semibold ${colorClass} ${score === null && !editMode ? "cursor-default" : ""}`}
        >
          {saving
            ? "…"
            : copied
              ? "Copied!"
              : score === null
                ? "—"
                : formatScore(score)}
        </button>
        {changedFrom !== null && (
          <span
            aria-hidden="true"
            className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-white dark:ring-surface"
          />
        )}
      </div>

      {regradeMode && (
        <button
          onClick={onRegrade}
          disabled={regrading}
          title="Regrade this answer"
          className="shrink-0 rounded border border-neutral-300 px-1.5 py-1 text-xs text-neutral-500 hover:border-brand-maroon hover:text-brand-maroon disabled:opacity-50 dark:border-border dark:text-muted dark:hover:border-brand-crimson dark:hover:text-brand-crimson"
        >
          {regrading ? "…" : "↻"}
        </button>
      )}

      {open && feedback && (
        <div className="absolute z-10 top-full mt-1 w-64 rounded border border-neutral-200 bg-white p-3 text-xs text-neutral-700 shadow-lg dark:border-border dark:bg-surface-muted dark:text-foreground">
          {feedback}
        </div>
      )}
    </div>
  );
}
