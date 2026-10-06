"use client";

import { SCORE_STEPS } from "@/lib/scoreStep";

// Segmented buttons choosing how finely the AI may split points on a question.
export function ScoreStepPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (step: number) => void;
}) {
  return (
    <div className="mt-2 flex items-center gap-2 text-xs text-neutral-500 dark:text-muted">
      <span>Partial credit</span>
      <div role="radiogroup" aria-label="Partial credit increment" className="flex overflow-hidden rounded border border-neutral-300 dark:border-border">
        {SCORE_STEPS.map((step) => (
          <button
            key={step}
            type="button"
            role="radio"
            aria-checked={value === step}
            onClick={() => onChange(step)}
            className={`px-2 py-1 ${
              value === step
                ? "bg-brand-maroon text-white"
                : "bg-white text-neutral-700 hover:bg-neutral-100 dark:bg-surface-muted dark:text-foreground"
            }`}
          >
            {step === 1 ? "Whole" : step}
          </button>
        ))}
      </div>
    </div>
  );
}
