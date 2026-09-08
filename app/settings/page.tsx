"use client";

import { useEffect, useState } from "react";
import { parseJsonResponse } from "@/lib/apiClient";

type SettingsResponse = {
  model: string;
  baseUrl: string | null;
  hasApiKey: boolean;
  apiKeyPreview: string | null;
  savedModels: string[];
  hasPin: boolean;
};

const MIN_PIN_LENGTH = 4;

export default function SettingsPage() {
  const [model, setModel] = useState("gpt-4o-mini");
  const [savedModels, setSavedModels] = useState<string[]>([]);
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [hasApiKey, setHasApiKey] = useState(false);
  const [apiKeyPreview, setApiKeyPreview] = useState<string | null>(null);
  const [hasPin, setHasPin] = useState(false);
  const [unlocked, setUnlocked] = useState(false);

  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinAttempt, setPinAttempt] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  async function load() {
    setLoading(true);
    setLoadFailed(false);
    setError(null);
    try {
      const res = await fetch("/api/settings");
      const data = await parseJsonResponse<SettingsResponse>(res);
      setModel(data.model);
      setSavedModels(data.savedModels);
      setBaseUrl(data.baseUrl ?? "");
      setHasApiKey(data.hasApiKey);
      setApiKeyPreview(data.apiKeyPreview);
      setHasPin(data.hasPin);
      setUnlocked(!data.hasPin);
    } catch (err) {
      // Don't fall back to the locked or editable views on a failed load —
      // we don't actually know hasPin, so guessing either way is wrong.
      setLoadFailed(true);
      setError(
        err instanceof Error ? err.message : "Failed to load settings."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount
    load();
  }, []);

  async function handleUnlock() {
    setUnlocking(true);
    setPinError(null);
    try {
      const res = await fetch("/api/settings/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pinAttempt }),
      });
      const data = await parseJsonResponse<{ valid: boolean }>(res);
      if (data.valid) {
        setUnlocked(true);
        setPinAttempt("");
      } else {
        setPinError("Incorrect PIN.");
      }
    } catch (err) {
      setPinError(err instanceof Error ? err.message : "Failed to verify PIN.");
    } finally {
      setUnlocking(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/settings/test", { method: "POST" });
      const data = await parseJsonResponse<{
        ok: boolean;
        model?: string;
        reply?: string;
        error?: string;
      }>(res);
      setTestResult(
        data.ok
          ? { ok: true, message: `${data.model} responded: "${data.reply}"` }
          : { ok: false, message: data.error ?? "Test failed." }
      );
    } catch (err) {
      setTestResult({
        ok: false,
        message: err instanceof Error ? err.message : "Test failed.",
      });
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    setError(null);
    setSaved(false);
    setTestResult(null);

    if (!hasPin) {
      if (newPin.length < MIN_PIN_LENGTH) {
        setError(`Choose a PIN of at least ${MIN_PIN_LENGTH} digits.`);
        return;
      }
      if (newPin !== confirmPin) {
        setError("PINs don't match.");
        return;
      }
    }

    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "openai",
          model,
          baseUrl,
          apiKey,
          newPin: hasPin ? undefined : newPin,
        }),
      });
      const data = await parseJsonResponse<SettingsResponse>(res);
      setSavedModels(data.savedModels);
      setBaseUrl(data.baseUrl ?? "");
      setHasApiKey(data.hasApiKey);
      setApiKeyPreview(data.apiKeyPreview);
      setHasPin(data.hasPin);
      setApiKey("");
      setNewPin("");
      setConfirmPin("");
      setSaved(true);
      // Lock the panel back into read-only display now that it's saved.
      setUnlocked(false);
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

  if (loadFailed) {
    return (
      <div className="mx-auto max-w-xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <div className="mt-6 rounded-lg border border-neutral-200 bg-white p-6 dark:border-border dark:bg-surface">
          <p className="text-sm text-red-600">{error}</p>
          <button
            onClick={load}
            className="mt-4 rounded bg-brand-ink px-4 py-2 text-sm font-medium text-white hover:bg-brand-maroon dark:bg-brand-crimson dark:hover:opacity-90"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <p className="mt-1 text-sm text-neutral-600 dark:text-muted">
        Configure the AI model used to grade submissions.
      </p>

      {saved && !unlocked && (
        <p className="mt-4 text-sm text-green-600 dark:text-green-400">
          Settings saved and locked.
        </p>
      )}
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {!unlocked ? (
        <div className="mt-6 space-y-5 rounded-lg border border-neutral-200 bg-white p-6 dark:border-border dark:bg-surface">
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-neutral-500 dark:text-muted">Provider</dt>
              <dd className="font-medium text-neutral-900 dark:text-foreground">OpenAI</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-neutral-500 dark:text-muted">Base URL</dt>
              <dd className="font-medium text-neutral-900 dark:text-foreground">
                {baseUrl || "Default"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-neutral-500 dark:text-muted">Model</dt>
              <dd className="font-medium text-neutral-900 dark:text-foreground">{model}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-neutral-500 dark:text-muted">API key</dt>
              <dd className="font-medium text-neutral-900 dark:text-foreground">
                {hasApiKey ? apiKeyPreview : "Not set"}
              </dd>
            </div>
          </dl>

          <div>
            <button
              onClick={handleTest}
              disabled={testing || !hasApiKey}
              className="rounded border border-neutral-300 px-4 py-1.5 text-sm font-medium text-neutral-700 hover:border-brand-maroon hover:text-brand-maroon disabled:opacity-50 dark:border-border dark:text-foreground dark:hover:border-brand-crimson dark:hover:text-brand-crimson"
            >
              {testing ? "Testing…" : "Test connection"}
            </button>
            {testResult && (
              <p
                className={`mt-2 text-sm ${testResult.ok ? "text-green-600 dark:text-green-400" : "text-red-600"}`}
              >
                {testResult.ok ? "✓ " : "✗ "}
                {testResult.message}
              </p>
            )}
          </div>

          <div className="border-t border-neutral-200 pt-5 dark:border-border">
            <label className="block text-xs font-medium text-neutral-500 dark:text-muted">
              Enter PIN to edit
            </label>
            <div className="mt-1 flex gap-2">
              <input
                type="password"
                inputMode="numeric"
                value={pinAttempt}
                onChange={(e) => setPinAttempt(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
                className="w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 dark:border-border dark:bg-surface-muted dark:text-foreground"
              />
              <button
                onClick={handleUnlock}
                disabled={unlocking || !pinAttempt}
                className="shrink-0 rounded bg-brand-ink px-4 py-2 text-sm font-medium text-white hover:bg-brand-maroon disabled:opacity-50 dark:bg-brand-crimson dark:hover:opacity-90"
              >
                {unlocking ? "Checking…" : "Unlock"}
              </button>
            </div>
            {pinError && <p className="mt-2 text-sm text-red-600">{pinError}</p>}
          </div>
        </div>
      ) : (
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
              Base URL
            </label>
            <input
              type="url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.openai.com/v1"
              className="mt-1 w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 dark:border-border dark:bg-surface-muted dark:text-foreground dark:placeholder:text-muted"
            />
            <p className="mt-1 text-xs text-neutral-500 dark:text-muted">
              Optional — only needed for a proxy, Azure OpenAI, or another
              OpenAI-compatible endpoint. Leave blank for the default.
            </p>
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

          <div>
            <button
              onClick={handleTest}
              disabled={testing || !hasApiKey}
              className="rounded border border-neutral-300 px-4 py-1.5 text-sm font-medium text-neutral-700 hover:border-brand-maroon hover:text-brand-maroon disabled:opacity-50 dark:border-border dark:text-foreground dark:hover:border-brand-crimson dark:hover:text-brand-crimson"
            >
              {testing ? "Testing…" : "Test connection"}
            </button>
            <p className="mt-1 text-xs text-neutral-500 dark:text-muted">
              Tests the currently saved key/model — save first if you just
              changed them.
            </p>
            {testResult && (
              <p
                className={`mt-2 text-sm ${testResult.ok ? "text-green-600 dark:text-green-400" : "text-red-600"}`}
              >
                {testResult.ok ? "✓ " : "✗ "}
                {testResult.message}
              </p>
            )}
          </div>

          {!hasPin && (
            <div className="space-y-3 rounded-md border border-dashed border-neutral-300 p-4 dark:border-border">
              <p className="text-xs font-medium text-neutral-700 dark:text-foreground">
                Create a PIN — saving will lock these settings, and you&apos;ll
                need this PIN to edit them again.
              </p>
              <div>
                <label className="block text-xs font-medium text-neutral-500 dark:text-muted">
                  New PIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  placeholder={`at least ${MIN_PIN_LENGTH} digits`}
                  className="mt-1 w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 dark:border-border dark:bg-surface-muted dark:text-foreground dark:placeholder:text-muted"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-500 dark:text-muted">
                  Confirm PIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value)}
                  className="mt-1 w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 dark:border-border dark:bg-surface-muted dark:text-foreground"
                />
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded bg-brand-ink px-5 py-2 text-sm font-medium text-white hover:bg-brand-maroon disabled:opacity-50 dark:bg-brand-crimson dark:hover:opacity-90"
            >
              {saving ? "Saving…" : hasPin ? "Save & lock" : "Save & create PIN"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
