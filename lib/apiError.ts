export function toErrorMessage(err: unknown): string {
  if (err && typeof err === "object") {
    const anyErr = err as { code?: string; message?: string };
    const msg = anyErr.message ?? "";
    if (
      anyErr.code === "P1001" ||
      /can't reach database|databasenotreachable|econnrefused/i.test(msg)
    ) {
      return "Can't reach the database. Check that DATABASE_URL is set correctly for this deployment and that the database is reachable.";
    }
    if (msg) return msg;
  }
  return "Unexpected server error.";
}
