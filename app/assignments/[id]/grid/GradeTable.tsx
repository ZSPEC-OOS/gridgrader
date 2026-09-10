"use client";

import { useState } from "react";
import { GradeCell } from "./GradeCell";
import { CanvasTransferButton } from "./CanvasTransferButton";

type Grade = { score: number; feedback: string } | null;

type Question = {
  id: string;
  index: number;
  header: string;
  maxScore: number;
};

type Student = {
  id: string;
  name: string;
  answers: {
    id: string;
    questionId: string;
    grade: Grade;
  }[];
};

const REGRADE_QUESTION_BATCH_SIZE = 40;

export function GradeTable({
  assignmentId,
  assignmentName,
  questions,
  students,
}: {
  assignmentId: string;
  assignmentName: string;
  questions: Question[];
  students: Student[];
}) {
  const [grades, setGrades] = useState<Record<string, Grade>>(() => {
    const initial: Record<string, Grade> = {};
    for (const student of students) {
      for (const answer of student.answers) {
        initial[answer.id] = answer.grade;
      }
    }
    return initial;
  });
  const [regradeMode, setRegradeMode] = useState(false);
  const [copyMode, setCopyMode] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [regradingId, setRegradingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [regradingQuestionId, setRegradingQuestionId] = useState<string | null>(null);
  const [questionRegradeProgress, setQuestionRegradeProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  // answerId -> the score it held immediately before its most recent
  // regrade, but only when that regrade actually changed it — this drives
  // the "changed" dot on the cell. Cleared once a later regrade (or manual
  // edit) leaves the score unchanged, so it never goes stale.
  const [scoreChanges, setScoreChanges] = useState<Record<string, number>>({});

  const totalMax = questions.reduce((s, q) => s + q.maxScore, 0);

  function recordScoreChange(answerId: string, previousScore: number | null, newScore: number) {
    setScoreChanges((prev) => {
      if (previousScore !== null && newScore !== previousScore) {
        return { ...prev, [answerId]: previousScore };
      }
      if (!(answerId in prev)) return prev;
      const next = { ...prev };
      delete next[answerId];
      return next;
    });
  }

  async function handleRegrade(answerId: string) {
    setRegradingId(answerId);
    const previousScore = grades[answerId]?.score ?? null;
    try {
      const res = await fetch(`/api/assignments/${assignmentId}/grade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answerId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Regrade failed.");
      setGrades((prev) => ({
        ...prev,
        [answerId]: { score: data.score, feedback: data.feedback },
      }));
      recordScoreChange(answerId, previousScore, data.score);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Regrade failed.");
    } finally {
      setRegradingId(null);
    }
  }

  async function handleRegradeQuestion(questionId: string) {
    setRegradingQuestionId(questionId);
    setQuestionRegradeProgress({ done: 0, total: 0 });

    // Snapshot every affected answer's score before the run starts, so the
    // "changed" indicator reflects the net effect of this regrade rather
    // than an intermediate value from partway through a multi-batch run.
    const previousScores = new Map<string, number | null>();
    for (const student of students) {
      const answer = student.answers.find((a) => a.questionId === questionId);
      if (answer) previousScores.set(answer.id, grades[answer.id]?.score ?? null);
    }

    let offset = 0;
    let gradedTotal = 0;
    let total = 0;
    const allErrors: string[] = [];

    try {
      for (;;) {
        const res = await fetch(`/api/assignments/${assignmentId}/grade`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questionId,
            offset,
            limit: REGRADE_QUESTION_BATCH_SIZE,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Regrade failed.");

        const results = data.results as
          | { answerId: string; score: number; feedback: string }[]
          | undefined;

        if (results?.length) {
          setGrades((prev) => {
            const next = { ...prev };
            for (const r of results) {
              next[r.answerId] = { score: r.score, feedback: r.feedback };
            }
            return next;
          });
          for (const r of results) {
            recordScoreChange(r.answerId, previousScores.get(r.answerId) ?? null, r.score);
          }
        }

        gradedTotal += data.graded;
        total = data.total;
        allErrors.push(...data.errors);
        setQuestionRegradeProgress({ done: Math.min(offset + data.limit, total), total });

        if (data.done) break;
        offset = data.offset + data.limit;
      }

      if (allErrors.length > 0) {
        const preview = allErrors.slice(0, 5).join("\n");
        const more = allErrors.length > 5 ? `\n…and ${allErrors.length - 5} more` : "";
        alert(
          `Regraded ${gradedTotal} of ${total}. ${allErrors.length} failed:\n${preview}${more}`
        );
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Regrade failed.");
    } finally {
      setRegradingQuestionId(null);
      setQuestionRegradeProgress(null);
    }
  }

  async function handleManualEdit(answerId: string, score: number) {
    setSavingId(answerId);
    try {
      const res = await fetch(`/api/assignments/${assignmentId}/grade`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answerId, score }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed.");
      setGrades((prev) => ({
        ...prev,
        [answerId]: { score: data.score, feedback: data.feedback },
      }));
      // A manual override resolves whatever the AI regraded it to — drop
      // the "changed by regrade" indicator rather than leave it stale.
      setScoreChanges((prev) => {
        if (!(answerId in prev)) return prev;
        const next = { ...prev };
        delete next[answerId];
        return next;
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="mt-6">
      <div className="mb-3 flex flex-wrap items-center gap-6">
        <ToggleSwitch
          checked={regradeMode}
          onChange={setRegradeMode}
          label="Per-question regrade"
        />
        <ToggleSwitch
          checked={copyMode}
          onChange={setCopyMode}
          label="Click score to copy"
        />
        <ToggleSwitch
          checked={editMode}
          onChange={setEditMode}
          label="Manual override"
        />
        {editMode && (
          <span className="text-xs text-neutral-500 dark:text-muted">
            Click a score to set it directly — whole points only.
          </span>
        )}
      </div>

      <div className="mb-4">
        <CanvasTransferButton
          assignmentId={assignmentId}
          assignmentName={assignmentName}
          questions={questions}
          students={students.map((s) => ({
            id: s.id,
            name: s.name,
            answers: s.answers.map((a) => ({ id: a.id, questionId: a.questionId })),
          }))}
          grades={grades}
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white dark:border-border dark:bg-surface">
        <table className="w-full min-w-max border-collapse text-sm">
          <thead>
            <tr className="bg-neutral-50 text-left text-xs uppercase text-neutral-500 dark:bg-surface-muted dark:text-muted">
              <th className="sticky left-0 z-10 bg-neutral-50 px-4 py-3 dark:bg-surface-muted">
                Student
              </th>
              {questions.map((q) => (
                <th key={q.id} className="px-4 py-3 align-top">
                  {/* Question text stays on its own line so the regrade-all
                      button (shown only in regrade mode, on the line below)
                      never shifts or wraps the header text itself. */}
                  <div className="whitespace-nowrap">
                    {q.header}
                    <span className="ml-1 font-normal normal-case text-neutral-400 dark:text-muted">
                      ({q.maxScore} pts)
                    </span>
                  </div>
                  {regradeMode && (
                    <button
                      onClick={() => handleRegradeQuestion(q.id)}
                      disabled={regradingQuestionId === q.id}
                      title="Regrade this question for every student"
                      className="mt-1.5 whitespace-nowrap rounded border border-neutral-300 px-2 py-0.5 text-[10px] font-normal normal-case text-neutral-500 hover:border-brand-maroon hover:text-brand-maroon disabled:opacity-50 dark:border-border dark:text-muted dark:hover:border-brand-crimson dark:hover:text-brand-crimson"
                    >
                      {regradingQuestionId === q.id
                        ? questionRegradeProgress && questionRegradeProgress.total > 0
                          ? `Regrading ${questionRegradeProgress.done}/${questionRegradeProgress.total}…`
                          : "Regrading…"
                        : "↻ Regrade all"}
                    </button>
                  )}
                </th>
              ))}
              <th className="px-4 py-3 whitespace-nowrap">Total</th>
            </tr>
          </thead>
          <tbody className="text-neutral-900 dark:text-foreground">
            {students.map((student) => {
              const answerByQuestion = new Map(
                student.answers.map((a) => [a.questionId, a])
              );
              const total = student.answers.reduce(
                (s, a) => s + (grades[a.id]?.score ?? 0),
                0
              );
              const anyGraded = student.answers.some((a) => grades[a.id]);

              return (
                <tr
                  key={student.id}
                  className="border-t border-neutral-100 dark:border-border"
                >
                  <td className="sticky left-0 z-10 bg-white px-4 py-2 font-medium dark:bg-surface">
                    {student.name}
                  </td>
                  {questions.map((q) => {
                    const answer = answerByQuestion.get(q.id);
                    const grade = answer ? grades[answer.id] : null;
                    return (
                      <td key={q.id} className="px-4 py-2">
                        {answer && (
                          <GradeCell
                            score={grade?.score ?? null}
                            maxScore={q.maxScore}
                            feedback={grade?.feedback ?? null}
                            regradeMode={regradeMode}
                            copyMode={copyMode}
                            editMode={editMode}
                            regrading={regradingId === answer.id}
                            saving={savingId === answer.id}
                            changedFrom={scoreChanges[answer.id] ?? null}
                            onRegrade={() => handleRegrade(answer.id)}
                            onManualEdit={(score) => handleManualEdit(answer.id, score)}
                          />
                        )}
                      </td>
                    );
                  })}
                  <td className="px-4 py-2 text-sm font-semibold">
                    {anyGraded ? `${total.toFixed(1)} / ${totalMax}` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ToggleSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-700 dark:text-foreground">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
          checked ? "bg-brand-crimson" : "bg-neutral-300 dark:bg-border"
        }`}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
            checked ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </button>
      {label}
    </label>
  );
}
