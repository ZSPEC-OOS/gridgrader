// Per-question grading precision: 1 (whole points), 0.5 or 0.25. All are
// exact binary fractions, so multiples of them carry no float error.
export const SCORE_STEPS = [1, 0.5, 0.25] as const;
export type ScoreStep = (typeof SCORE_STEPS)[number];

export function resolveScoreStep(value: unknown): ScoreStep {
  return SCORE_STEPS.find((s) => s === value) ?? 1;
}

export function describeScoreStep(step: number): string {
  return step === 1 ? "whole points" : `increments of ${step}`;
}

// Whole-point grading on a decimal maximum (e.g. 1.5) has no meaningful
// intermediate whole value, so such a question is all-or-nothing.
export function isAllOrNothing(maxScore: number, step: number): boolean {
  return step === 1 && !Number.isInteger(maxScore);
}

// Score is clamped to [0, maxScore] and rounded to the nearest step. The
// question maximum itself is always reachable, even when it is not a
// multiple of the step.
export function roundToStep(score: number, maxScore: number, step: number): number {
  const clamped = Math.min(Math.max(score, 0), maxScore);
  if (clamped >= maxScore) return maxScore;
  if (isAllOrNothing(maxScore, step)) return clamped >= maxScore / 2 ? maxScore : 0;
  return Math.min(Math.round(clamped / step) * step, maxScore);
}

export function isAllowedScore(score: number, maxScore: number, step: number): boolean {
  if (!Number.isFinite(score) || score < 0 || score > maxScore) return false;
  if (isAllOrNothing(maxScore, step)) return score === 0 || score === maxScore;
  return score === maxScore || Number.isInteger(score / step);
}
