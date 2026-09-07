"use client";

import { useEffect, useState } from "react";

const MODEL_OPTIONS = [
  "gpt-4o-mini",
  "gpt-4o",
  "gpt-4.1",
  "gpt-4.1-mini",
  "o4-mini",
];

export default function SettingsPage() {
  const [model, setModel] = useState("gpt-4o-mini");
  const [apiKey, setApiKey] = useState("");
  const [hasApiKey, setHasApiKey] = useState(false);
  const [apiKeyPreview, setApiKeyPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        setModel(data.model);
        setHasApiKey(data.hasApiKey);
        setApiKeyPreview(data.apiKeyPreview);
        setLoading(false);
      });
  }, []);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "openai", model, apiKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save.");
      setHasApiKey(data.hasApiKey);
      setApiKeyPreview(data.apiKeyPreview);
      setApiKey("");
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-xl px-6 py-10">
        <p className="text-sm text-neutral-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Configure the AI model used to grade submissions.
      </p>

      <div className="mt-6 space-y-5 rounded-lg border border-neutral-200 bg-white p-6">
        <div>
          <label className="block text-xs font-medium text-neutral-500">
            Provider
          </label>
          <select
            disabled
            value="openai"
            className="mt-1 w-full rounded border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm text-neutral-600"
          >
            <option value="openai">OpenAI</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-neutral-500">
            Model
          </label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 text-sm"
          >
            {MODEL_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
            {!MODEL_OPTIONS.includes(model) && (
              <option value={model}>{model}</option>
            )}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-neutral-500">
            API key
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={hasApiKey ? apiKeyPreview ?? "" : "sk-..."}
            className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-neutral-500">
            {hasApiKey
              ? "A key is already saved. Leave blank to keep it."
              : "No key saved yet."}
          </p>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {saved && (
          <p className="text-sm text-green-600">Settings saved.</p>
        )}

        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded bg-neutral-900 px-5 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
