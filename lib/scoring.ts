// Keep rubric expansion bounded in both the server and the browser.
const MAX_ALLOWED_SCORES = 256;
const MAX_COMPONENTS = 64;
const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

/**
 * Recognize positive, numeric scoring directives at the start of a rubric
 * clause. Ambiguous prose is deliberately all-or-nothing. Separate additive
 * components with semicolons, newlines or sentences; alternatives (if/when,
 * "partially correct", or "or") are levels, never additive components.
 * Repeated allocations require an explicit item count. No numeric amounts
 * are inferred from phrases such as "half credit".
 */
export function getAllowedScores(criteria: string, maxScore: number): number[] {
  if (!Number.isFinite(maxScore) || maxScore <= 0) return [0];
  const baseline = [0, maxScore];
  if (/\b(?:no|never|without|do not|don’t|don't)\s+(?:(?:award|give|allow)\s+)?(?:any\s+)?(?:partial|half)[-\s]+(?:credit|points?)\b|\ball[-\s]+or[-\s]+nothing\b/i.test(criteria)) return baseline;
  const allowed = new Set(baseline);
  const components: number[] = [];
  const seenComponents = new Set<string>();
  // Do not split decimal literals. Strip quoted examples before parsing.
  const text = criteria.replace(/"[^"\n]*"|“[^”\n]*”|`[^`\n]*`/g, "");
  const clauses = text.split(/;|\n|\.(?=\s|$)/);
  const alternatives = /\b(?:or|either|instead|otherwise)\b/i.test(text);
  for (const raw of clauses) {
    const clause = raw.trim().replace(/^[-*•]\s+/, "").replace(/^or\s+/i, "");
    // A restriction, deduction or example is not positive authorization.
    if (/\b(?:no|not|never|without|deduct|subtract|lose|penalty|example|e\.g)\b|n't\b/i.test(clause)) continue;
    const match = clause.match(
      /^(?:(?:award|give|score)\s+(?:exactly\s+)?)?(\d+(?:\.\d+)?|\.\d+)\s*(?:points?|pts?)\b\s*(for\b|per\b|if\b|when\b|:|$)(.*)$/i
    );
    if (!match) continue;
    const value = Number(match[1]);
    if (!Number.isFinite(value) || value <= 0 || value >= maxScore) continue;
    allowed.add(value);
    const connector = match[2].toLowerCase();
    const condition = match[3].trim();
    const level = alternatives || /^(?:if|when)$/.test(connector) ||
      /\b(?:partial(?:ly)?|instead|otherwise|total|overall)\b/i.test(condition);
    if (level) continue;
    const componentKey = `${value}:${connector}:${condition.toLowerCase()}`;
    if (seenComponents.has(componentKey)) continue;
    seenComponents.add(componentKey);
    const repeated = connector === "per" || /^each\b/i.test(condition);
    if (repeated) {
      const countMatch = condition.match(/^(?:each\s+of\s+)?(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b(?!\.\d)/i);
      if (!countMatch) continue;
      const count = NUMBER_WORDS[countMatch[1].toLowerCase()] ?? Number(countMatch[1]);
      if (!Number.isSafeInteger(count) || count < 1 || count > MAX_COMPONENTS) return baseline;
      for (let i = 0; i < count; i++) components.push(value);
    } else if (connector === "for" || connector === ":") {
      components.push(value);
    }
    if (components.length > MAX_COMPONENTS) return baseline;
  }

  // Only independently allocated components can be combined, once each.
  // Decimal arithmetic is normalized to machine precision, not six digits.
  let sums = new Set([0]);
  for (const value of components) {
    const next = new Set(sums);
    for (const subtotal of sums) {
      const sum = Number((subtotal + value).toPrecision(15));
      if (sum <= maxScore) next.add(sum);
    }
    if (next.size > MAX_ALLOWED_SCORES) return baseline;
    sums = next;
  }
  for (const sum of sums) allowed.add(sum);
  if (allowed.size > MAX_ALLOWED_SCORES) return baseline;
  return [...allowed].sort((a, b) => a - b);
}

export function matchAllowedScore(
  score: number,
  allowedScores: readonly number[]
): number | null {
  if (!Number.isFinite(score)) return null;
  // Allow only machine arithmetic noise, not rounding to a nearby grade.
  const match = allowedScores.find((allowed) =>
    Math.abs(allowed - score) <= Number.EPSILON * Math.max(Math.abs(allowed), Math.abs(score)) * 8
  );
  return match ?? null;
}

export function formatScore(score: number): string {
  return String(Number(score.toPrecision(15)));
}
