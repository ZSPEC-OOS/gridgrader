"use client";

import { useState } from "react";

export function GradeCell({
  score,
  maxScore,
  feedback,
}: {
  score: number | null;
  maxScore: number;
  feedback: string | null;
}) {
  const [open, setOpen] = useState(false);

  if (score === null) {
    return <span className="text-xs text-neutral-400 dark:text-muted">—</span>;
  }

  const pct = maxScore > 0 ? score / maxScore : 0;
  const colorClass =
    pct >= 0.8
      ? "bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300"
      : pct >= 0.6
        ? "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"
        : "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`w-full rounded px-2 py-1 text-xs font-semibold ${colorClass}`}
      >
        {score % 1 === 0 ? score : score.toFixed(1)} / {maxScore}
      </button>
      {open && feedback && (
        <div className="absolute z-10 mt-1 w-64 rounded border border-neutral-200 bg-white p-3 text-xs text-neutral-700 shadow-lg dark:border-border dark:bg-surface-muted dark:text-foreground">
          {feedback}
        </div>
      )}
    </div>
  );
}
