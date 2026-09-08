"use client";

import { useState } from "react";

export function GradeCell({
  score,
  maxScore,
  feedback,
  regradeMode,
  copyMode,
  regrading,
  onRegrade,
}: {
  score: number | null;
  maxScore: number;
  feedback: string | null;
  regradeMode: boolean;
  copyMode: boolean;
  regrading: boolean;
  onRegrade: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleScoreClick() {
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
      <button
        onClick={handleScoreClick}
        disabled={score === null}
        title={copyMode && score !== null ? "Click to copy" : undefined}
        className={`w-full rounded px-2 py-1 text-xs font-semibold ${colorClass} ${score === null ? "cursor-default" : ""}`}
      >
        {copied
          ? "Copied!"
          : score === null
            ? "—"
            : score % 1 === 0
              ? score
              : score.toFixed(1)}
      </button>

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
