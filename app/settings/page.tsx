"use client";

import { useEffect, useState } from "react";
import { parseJsonResponse } from "@/lib/apiClient";

type SettingsResponse = {
  model: string;
  hasApiKey: boolean;
  apiKeyPreview: string | null;
  savedModels: string[];
};

export default function SettingsPage() {
  const [model, setModel] = useState("gpt-4o-mini");
  const [savedModels, setSavedModels] = useState<string[]>([]);
  const [apiKey, setApiKey] = useState("");
  const [hasApiKey, setHasApiKey] = useState(false);
  const [apiKeyPreview, setApiKeyPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/settings");
        const data = await parseJsonResponse<SettingsResponse>(res);
        setModel(data.model);
        setSavedModels(data.savedModels);
        setHasApiKey(data.hasApiKey);
        setApiKeyPreview(data.apiKeyPreview);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load settings."
        );
      } finally {
        setLoading(false);
      }
    }
    load();
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
      const data = await parseJsonResponse<SettingsResponse>(res);
      setSavedModels(data.savedModels);
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
        <p className="text-sm text-neutral-500 dark:text-muted">Loading…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <p className="mt-1 text-sm text-neutral-600 dark:text-muted">
        Configure the AI model used to grade submissions.
      </p>

      <div className="mt-6 space-y-5 rounded-lg border border-neutral-200 bg-white p-6 dark:border-border dark:bg-surface">
        <div>
          <label className="block text-xs font-medium text-neutral-500 dark:text-muted">
            Provider
          </label>
          <select
            value="openai"
            onChange={() => {}}
            className="mt-1 w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 dark:border-border dark:bg-surface-muted dark:text-foreground"
          >
            <option value="openai">OpenAI</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-neutral-500 dark:text-muted">
            Model
          </label>
          <input
            list="model-options"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="Type a model name, e.g. gpt-4o-mini"
            className="mt-1 w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 dark:border-border dark:bg-surface-muted dark:text-foreground"
          />
          <datalist id="model-options">
            {savedModels.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
          <p className="mt-1 text-xs text-neutral-500 dark:text-muted">
            {savedModels.length > 0
              ? "Type any model name — models you've saved before are suggested."
              : "Type any model name and save it; it'll be suggested next time."}
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-neutral-500 dark:text-muted">
            API key
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={hasApiKey ? apiKeyPreview ?? "" : "sk-..."}
            className="mt-1 w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 dark:border-border dark:bg-surface-muted dark:text-foreground dark:placeholder:text-muted"
          />
          <p className="mt-1 text-xs text-neutral-500 dark:text-muted">
            {hasApiKey
              ? "A key is already saved. Leave blank to keep it."
              : "No key saved yet."}
          </p>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {saved && (
          <p className="text-sm text-green-600 dark:text-green-400">Settings saved.</p>
        )}

        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded bg-brand-ink px-5 py-2 text-sm font-medium text-white hover:bg-brand-maroon disabled:opacity-50 dark:bg-brand-crimson dark:hover:opacity-90"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
