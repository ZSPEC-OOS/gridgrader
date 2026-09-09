// Single source of truth for the grading strictness levels — shared by the
// grading prompt, the settings API, and the settings UI, so the labels,
// descriptions, and prompt language for each level can never drift apart.

export type GradingStrictnessLevel = 1 | 2 | 3 | 4 | 5;

export const DEFAULT_GRADING_STRICTNESS_LEVEL: GradingStrictnessLevel = 3;

type StrictnessMeta = {
  label: string;
  // Short, user-facing description shown under the settings control.
  description: string;
  // Instruction inserted into the grading system prompt for this level.
  prompt: string;
};

export const GRADING_STRICTNESS_LEVELS = {
  1: {
    label: "Very Lenient",
    description:
      "Credits intended conceptual understanding even when terminology or explanation is substantially imperfect.",
    prompt: `Grade very leniently for demonstrated conceptual understanding.
Award credit when the student's intended meaning is reasonably clear even if terminology is imprecise, incomplete, informal, or partially incorrect.
Accept implicit understanding when the response strongly indicates the required concept.
Do not require exact wording or keywords unless the instructor explicitly requires them.
Do not award credit for answers that are clearly incorrect, contradictory to the required concept, irrelevant, or blank.`,
  },
  2: {
    label: "Lenient",
    description:
      "Accepts clear understanding despite minor omissions or imprecise wording.",
    prompt: `Grade leniently.
Accept clear conceptual understanding despite minor omissions, shorthand, imprecise terminology, or incomplete explanation.
Give the student reasonable benefit of the doubt when the intended concept is scientifically clear.
Do not require exact wording unless explicitly required by the instructor.
Do not infer understanding when the answer is materially incorrect or ambiguous.`,
  },
  3: {
    label: "Balanced",
    description:
      "Requires the essential concept while accepting valid paraphrases and clear implicit understanding.",
    prompt: `Grade in a balanced manner.
Require the essential concept described by the rubric.
Accept scientifically valid paraphrases, equivalent terminology, and implicit statements when their meaning is clear.
Do not require exact wording unless explicitly required.
Do not award credit when a required concept is absent, contradicted, or only weakly implied.`,
  },
  4: {
    label: "Strict",
    description: "Requires each substantive rubric element to be clearly expressed.",
    prompt: `Grade strictly.
Require each substantive rubric component to be explicitly demonstrated in the student's answer.
Accept equivalent terminology, but do not infer missing concepts merely because the answer is related to the topic.
If a rubric component is not clearly expressed, do not award that component's credit.`,
  },
  5: {
    label: "Very Strict",
    description:
      "Applies the rubric literally and makes minimal inference beyond what the student explicitly states.",
    prompt: `Grade very strictly and apply the instructor's rubric literally.
Award credit only when the student's answer directly satisfies the stated criteria.
Make minimal inferences beyond what is explicitly written.
Do not treat related terminology, approximate ideas, or implied understanding as satisfying a required concept unless the rubric explicitly permits it.`,
  },
} satisfies Record<GradingStrictnessLevel, StrictnessMeta>;

export const GRADING_STRICTNESS_LEVEL_VALUES: readonly GradingStrictnessLevel[] = [
  1, 2, 3, 4, 5,
];

export function isGradingStrictnessLevel(
  value: unknown
): value is GradingStrictnessLevel {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 5
  );
}

// Never let an out-of-range or fractional value reach prompt construction —
// fall back to the documented default instead.
export function resolveGradingStrictnessLevel(
  value: unknown
): GradingStrictnessLevel {
  return isGradingStrictnessLevel(value)
    ? value
    : DEFAULT_GRADING_STRICTNESS_LEVEL;
}

export function getStrictnessGuidance(level: GradingStrictnessLevel): string {
  return GRADING_STRICTNESS_LEVELS[resolveGradingStrictnessLevel(level)].prompt;
}

export function getStrictnessLabel(level: GradingStrictnessLevel): string {
  return GRADING_STRICTNESS_LEVELS[resolveGradingStrictnessLevel(level)].label;
}
