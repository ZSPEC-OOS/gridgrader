import OpenAI from "openai";

export type GradeResult = {
  score: number;
  feedback: string;
};

export async function gradeAnswer(params: {
  apiKey: string;
  baseUrl?: string | null;
  model: string;
  useMaxCompletionTokens?: boolean;
  questionHeader: string;
  criteria: string;
  maxScore: number;
  studentName: string;
  answerText: string;
}): Promise<GradeResult> {
  const {
    apiKey,
    baseUrl,
    model,
    useMaxCompletionTokens,
    questionHeader,
    criteria,
    maxScore,
    answerText,
  } = params;

  const client = new OpenAI({
    apiKey,
    baseURL: baseUrl || undefined,
  });

  const system = `You are a strict but fair grading assistant. You grade one student's answer to one question against grading criteria provided by the instructor. Always respond with a single JSON object of the form {"score": number, "feedback": string}. "score" must be a number between 0 and ${maxScore} (may be fractional). "feedback" must be one or two concise sentences explaining the score, referencing the criteria.`;

  const user = [
    `Question: ${questionHeader}`,
    `Grading criteria / answer key (max score ${maxScore}):`,
    criteria || "(no specific criteria provided; use general judgment)",
    "",
    `Student's answer:`,
    answerText || "(no answer provided)",
  ].join("\n");

  // Newer models (the GPT-5/o-series reasoning family) reject the legacy
  // `max_tokens` param and require `max_completion_tokens` instead.
  const tokenLimitField = useMaxCompletionTokens
    ? { max_completion_tokens: 500 }
    : { max_tokens: 500 };

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
    temperature: 0,
    ...tokenLimitField,
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  let parsed: { score?: unknown; feedback?: unknown };
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Model returned invalid JSON: ${raw}`);
  }

  const score = Number(parsed.score);
  if (!Number.isFinite(score)) {
    throw new Error(`Model returned a non-numeric score: ${raw}`);
  }

  const feedback =
    typeof parsed.feedback === "string" ? parsed.feedback : "";

  return {
    score: Math.min(Math.max(score, 0), maxScore),
    feedback,
  };
}
