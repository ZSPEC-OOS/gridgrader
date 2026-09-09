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

  const totalMax = questions.reduce((s, q) => s + q.maxScore, 0);

  async function handleRegrade(answerId: string) {
    setRegradingId(answerId);
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
    } catch (err) {
      alert(err instanceof Error ? err.message : "Regrade failed.");
    } finally {
      setRegradingId(null);
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
                <th key={q.id} className="px-4 py-3 whitespace-nowrap">
                  {q.header}
                  <span className="ml-1 font-normal normal-case text-neutral-400 dark:text-muted">
                    ({q.maxScore} pts)
                  </span>
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
