"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (error) setError("E-mail ou senha incorretos.");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper bg-blueprint-grid px-4">
      <div className="w-full max-w-sm bg-card border border-line rounded-lg shadow-sm p-8">
        <div className="mb-8 text-center">
          <p className="text-xs tracking-[0.2em] text-blueprint font-mono uppercase mb-1">
            Diário de obra
          </p>
          <h1 className="text-2xl font-display font-semibold text-ink">
            ObraClínica
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-ink-soft mb-1" htmlFor="email">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-line bg-white px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-blueprint"
            />
          </div>
          <div>
            <label
              className="block text-sm text-ink-soft mb-1"
              htmlFor="password"
            >
              Senha
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-line bg-white px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-blueprint"
            />
          </div>

          {error && (
            <p className="text-sm text-safety border border-safety/30 bg-safety/10 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-blueprint hover:bg-blueprint-dark transition-colors text-white font-medium py-2.5 disabled:opacity-60"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p className="mt-6 text-xs text-ink-soft text-center">
          Acesso restrito — uso pessoal.
        </p>
      </div>
    </div>
  );
}
