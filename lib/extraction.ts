import OpenAI from "openai";
import { parseModelJson } from "./json";

export type ExtractedAnswer = {
  question: number;
  answer: string;
};

export type ExtractedStudent = {
  name: string | null;
  answers: ExtractedAnswer[];
};

// Adapted from the instructor-provided extraction spec. The spec's opening
// instructions ("first response must only request the ZIP", "deliver as a
// downloadable link", workbook/worksheet formatting) describe a
// conversational, whole-batch workflow; this app instead calls the model
// once per image via a stateless API, with the ZIP handling, batching,
// ordering, and .xlsx formatting (wrapped text, frozen header, autofilter,
// column widths) all done in this app's own code. The extraction rules
// below — what to pull off the page, what to exclude, how to handle
// missing/unreadable/multi-line/multiple-choice answers, and never
// summarizing or rewriting — are carried over as close to word-for-word as
// a single-image JSON response allows.
const SYSTEM_PROMPT = `You extract one student's submitted responses from a single screenshot of their assignment or reflection page, as one step in a pipeline that compiles every screenshot in a batch into one spreadsheet (one row per student, one column per question). Apply these rules exactly:

- Extract the student's name from the page header.
- Extract only the student's submitted answers.
- Do not include question text, scores, points, instructor comments, timestamps, buttons, navigation text, or other interface content.
- Preserve the student's wording, spelling, capitalization, and punctuation as closely as possible.
- Combine multi-line answers into one continuous string.
- For multiple-choice, checkbox, or Yes/No questions, record only the selected response.
- If a question has no submitted answer, use exactly: [No answer]
- If text is genuinely unreadable, use exactly: [unclear]
- Do not summarize, correct, rewrite, or interpret responses.

Respond with a single JSON object of the form {"name": string or null, "answers": [{"question": number, "answer": string}, ...]}. Number questions by their position as shown on the page (1, 2, 3, ...), covering every numbered question visible in the screenshot. If the student's name cannot be determined from the page header, use null for "name".`;

export async function extractStudentFromImage(params: {
  apiKey: string;
  baseUrl?: string | null;
  model: string;
  useMaxCompletionTokens?: boolean;
  imageBase64: string;
  mimeType: string;
}): Promise<ExtractedStudent> {
  const { apiKey, baseUrl, model, useMaxCompletionTokens, imageBase64, mimeType } =
    params;

  const client = new OpenAI({
    apiKey,
    baseURL: baseUrl || undefined,
  });

  // Screenshots can carry several questions' worth of text, so this needs a
  // more generous budget than a short grading-feedback response — and, for
  // reasoning models, that budget also has to cover internal reasoning
  // tokens, not just the visible output (see the same tradeoff in
  // lib/grading.ts).
  const reasoningModelFields = useMaxCompletionTokens
    ? { max_completion_tokens: 3000 }
    : { max_tokens: 2000, temperature: 0 };

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: "Extract this student's submission from the screenshot below." },
          {
            type: "image_url",
            image_url: { url: `data:${mimeType};base64,${imageBase64}` },
          },
        ],
      },
    ],
    response_format: { type: "json_object" },
    ...reasoningModelFields,
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  const parsed = parseModelJson(raw);

  const name = typeof parsed.name === "string" ? parsed.name : null;
  const rawAnswers = Array.isArray(parsed.answers) ? parsed.answers : [];

  const answers: ExtractedAnswer[] = rawAnswers
    .map((a): ExtractedAnswer | null => {
      if (!a || typeof a !== "object") return null;
      const q = Number((a as { question?: unknown }).question);
      const ans = (a as { answer?: unknown }).answer;
      if (!Number.isFinite(q)) return null;
      return { question: q, answer: typeof ans === "string" ? ans : "[unclear]" };
    })
    .filter((a): a is ExtractedAnswer => a !== null)
    .sort((a, b) => a.question - b.question);

  return { name, answers };
}
