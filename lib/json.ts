// `response_format: { type: "json_object" }` is an OpenAI-specific
// extension; a third-party "OpenAI-compatible" endpoint (this app's base
// URL is user-configurable specifically to support those) may ignore it
// and wrap the JSON in prose. Fall back to extracting the first balanced
// object before giving up, rather than failing outright on a provider
// that's otherwise working fine.
export function parseModelJson(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        // fall through to the error below
      }
    }
    throw new Error(`Model returned invalid JSON: ${raw}`);
  }
}
