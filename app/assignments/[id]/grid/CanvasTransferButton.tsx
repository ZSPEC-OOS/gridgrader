"use client";

import { useMemo, useState } from "react";
import { buildTransferPackage } from "@/lib/canvas-transfer/buildTransferPackage";
import {
  packageHasIncompleteScores,
  type CanvasTransferPackageV1,
} from "@/lib/canvas-transfer/schema";
import { createCanvasExportMessage } from "@/lib/canvas-transfer/message";

type Grade = { score: number; feedback: string } | null;

export function CanvasTransferButton({
  assignmentId,
  assignmentName,
  questions,
  students,
  grades,
}: {
  assignmentId: string;
  assignmentName: string;
  questions: Array<{ id: string; index: number; header: string; maxScore: number }>;
  students: Array<{ id: string; name: string; answers: Array<{ id: string; questionId: string }> }>;
  grades: Record<string, Grade>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pendingPackage, setPendingPackage] = useState<CanvasTransferPackageV1 | null>(null);
  const [sentAt, setSentAt] = useState<Date | null>(null);

  const totalAnswers = useMemo(
    () => students.reduce((sum, s) => sum + s.answers.length, 0),
    [students]
  );

  const hasRequiredData = questions.length > 0 && students.length > 0;

  function buildPackage(): CanvasTransferPackageV1 | null {
    setError(null);
    try {
      return buildTransferPackage({
        assignmentId,
        assignmentName,
        questions,
        students,
        grades,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to build the transfer package."
      );
      return null;
    }
  }

  function dispatchPackage(pkg: CanvasTransferPackageV1) {
    // A specific target origin (never "*") so the message can only be read
    // by a listener on this exact page's origin — see the extension's own
    // content-script origin check on the receiving end.
    window.postMessage(createCanvasExportMessage(pkg), window.location.origin);
    setPendingPackage(null);
    setSentAt(new Date());
  }

  function handleSendClick() {
    setSentAt(null);
    const pkg = buildPackage();
    if (!pkg) return;

    if (packageHasIncompleteScores(pkg)) {
      // Require an explicit second action rather than silently exporting
      // null scores as zero or skipping them.
      setPendingPackage(pkg);
      return;
    }

    dispatchPackage(pkg);
  }

  function handleConfirmIncomplete() {
    if (pendingPackage) dispatchPackage(pendingPackage);
  }

  const scored = useMemo(
    () =>
      students.reduce(
        (sum, s) => sum + s.answers.filter((a) => grades[a.id]?.score != null).length,
        0
      ),
    [students, grades]
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleSendClick}
          disabled={!hasRequiredData}
          className="rounded border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:border-brand-maroon hover:text-brand-maroon disabled:opacity-50 dark:border-border dark:text-foreground dark:hover:border-brand-crimson dark:hover:text-brand-crimson"
        >
          Send to Canvas Extension
        </button>
        <span className="text-xs text-neutral-500 dark:text-muted">
          {students.length} students · {questions.length} questions ·{" "}
          {scored}/{totalAnswers} answers scored
        </span>
      </div>

      {pendingPackage && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
          <p>
            This assignment has ungraded answers. They will be sent as{" "}
            <span className="font-medium">null</span>, not zero — the
            extension will not fill anything for them. Send anyway?
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={handleConfirmIncomplete}
              className="rounded bg-brand-ink px-3 py-1 text-xs font-medium text-white hover:bg-brand-maroon dark:bg-brand-crimson dark:hover:opacity-90"
            >
              Send incomplete package
            </button>
            <button
              type="button"
              onClick={() => setPendingPackage(null)}
              className="rounded border border-neutral-300 px-3 py-1 text-xs text-neutral-700 dark:border-border dark:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      {sentAt && !pendingPackage && (
        <p className="text-xs text-green-600 dark:text-green-400">
          Transfer package sent to browser at {sentAt.toLocaleTimeString()}.
          GridGrader can&apos;t verify Canvas was updated — check the
          extension to confirm it received the package.
        </p>
      )}
    </div>
  );
}
