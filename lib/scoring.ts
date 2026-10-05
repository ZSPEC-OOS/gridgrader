const SCORE_PRECISION = 6;
const SCORE_EPSILON = 1e-6;

function cleanScore(value: number): number {
  return Number(value.toFixed(SCORE_PRECISION));
}

function addIfPartial(target: Set<number>, value: number, maxScore: number) {
  const cleaned = cleanScore(value);
  if (Number.isFinite(cleaned) && cleaned > 0 && cleaned < maxScore) {
    target.add(cleaned);
  }
}

/**
 * Derives the scores that an instructor has actually authorized.
 *
 * A decimal question maximum (for example 1.5) does not itself authorize
 * partial credit. Without an explicit partial-credit amount in the answer
 * key, the only valid scores are 0 and full credit.
 *
 * Numeric point-bearing rubric components are additive. Explicit level
 * scores ("award 0.5 points", "1 point if...") are also accepted directly.
 * Ambiguous text such as "partial credit allowed" without an amount does
 * not create a new score.
 */
export function getAllowedScores(criteria: string, maxScore: number): number[] {
  if (!Number.isFinite(maxScore) || maxScore <= 0) return [0];

  const max = cleanScore(maxScore);
  const allowed = new Set<number>([0, max]);
  const componentValues: number[] = [];

  // Component-style allocations: "1 point for X", "0.5 pts: explanation",
  // "1 point per item", etc. These may be combined when multiple components
  // are satisfied.
  const componentPattern =
    /(\d+(?:\.\d+)?)\s*(?:points?|pts?)\s*(?:(?:each\s+)?(?:for|per)\b|:)/gi;

  for (const match of criteria.matchAll(componentPattern)) {
    const value = Number(match[1]);
    if (!Number.isFinite(value) || value <= 0 || value >= max) continue;

    componentValues.push(cleanScore(value));
    addIfPartial(allowed, value, max);

    // "1 point per item" / "1 point each for..." explicitly authorizes
    // repeated increments of that amount up to full credit.
    const phrase = match[0].toLowerCase();
    const nearby = criteria
      .slice(match.index ?? 0, (match.index ?? 0) + match[0].length + 12)
      .toLowerCase();
    if (phrase.includes("per") || phrase.includes("each") || nearby.includes("for each")) {
      for (let total = value; total < max - SCORE_EPSILON; total += value) {
        addIfPartial(allowed, total, max);
      }
    }
  }

  // Numeric scoring levels that are not necessarily additive.
  const explicitPatterns = [
    /(?:award|give|score|worth)\s+(?:exactly\s+)?(\d+(?:\.\d+)?)\s*(?:points?|pts?)\b/gi,
    /(\d+(?:\.\d+)?)\s*(?:points?|pts?)\s*(?:if|when)\b/gi,
  ];

  for (const pattern of explicitPatterns) {
    for (const match of criteria.matchAll(pattern)) {
      addIfPartial(allowed, Number(match[1]), max);
    }
  }

  // Multiple independently point-bearing components can be combined. Keep
  // the set bounded by maxScore and normalize floating-point arithmetic.
  let sums = new Set<number>([0]);
  for (const component of componentValues) {
    const next = new Set(sums);
    for (const subtotal of sums) {
      const combined = cleanScore(subtotal + component);
      if (combined <= max + SCORE_EPSILON) next.add(Math.min(combined, max));
    }
    sums = next;
  }
  for (const sum of sums) addIfPartial(allowed, sum, max);

  // Common textual fraction directive with an unambiguous amount.
  if (/\bhalf(?:-|\s)?credit\b|\bhalf(?:-|\s)?points?\b/i.test(criteria)) {
    addIfPartial(allowed, max / 2, max);
  }

  return [...allowed].sort((a, b) => a - b);
}

export function matchAllowedScore(
  score: number,
  allowedScores: readonly number[]
): number | null {
  if (!Number.isFinite(score)) return null;
  const match = allowedScores.find(
    (allowed) => Math.abs(allowed - score) <= SCORE_EPSILON
  );
  return match === undefined ? null : match;
}

export function formatScore(score: number): string {
  return String(cleanScore(score));
}
