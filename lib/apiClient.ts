export async function parseJsonResponse<T = unknown>(res: Response): Promise<T> {
  const text = await res.text();
  let data: unknown = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(
        res.ok
          ? "Server returned an invalid response."
          : `Server error (${res.status}): ${text.slice(0, 200)}`
      );
    }
  }

  if (!res.ok) {
    const message =
      data &&
      typeof data === "object" &&
      "error" in data &&
      typeof (data as { error?: unknown }).error === "string"
        ? (data as { error: string }).error
        : `Server error (${res.status}). The server returned no details.`;
    throw new Error(message);
  }

  return data as T;
}
