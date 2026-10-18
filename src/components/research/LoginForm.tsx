"use client";

import { FormEvent, useState } from "react";
import { useSearchParams } from "next/navigation";

export function LoginForm() {
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        setError("Wrong password.");
        return;
      }
      const next = params.get("next") || "/research";
      window.location.assign(next);
    } catch {
      setError("Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <form
        onSubmit={onSubmit}
        className="glass-panel w-full max-w-md rounded-2xl p-8 space-y-5"
      >
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-[var(--muted)]">
            Feature 2
          </p>
          <h1 className="display-font text-3xl mt-2">Jury access</h1>
          <p className="text-[var(--muted)] mt-2 text-sm">
            Enter the shared password to open the deep research harness.
          </p>
        </div>
        <label className="block space-y-2">
          <span className="text-sm text-[var(--muted)]">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-[var(--glass-border)] bg-black/20 px-4 py-3 outline-none focus:border-[var(--accent)]"
            autoComplete="current-password"
            required
          />
        </label>
        {error && <p className="text-[var(--risk-high)] text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-[var(--accent)] text-[#042029] font-semibold py-3 disabled:opacity-60"
        >
          {loading ? "Checking…" : "Enter research"}
        </button>
      </form>
    </main>
  );
}
