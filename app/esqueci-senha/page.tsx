"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { createClient } from "@/utils/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setSent(false);
    setError("");

    try {
      const supabase = createClient();
      const { error: requestError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/callback?next=/redefinir-senha`,
      });

      if (requestError) throw requestError;
      setSent(true);
    } catch {
      setError("Não foi possível solicitar a redefinição agora. Tente novamente em alguns minutos.");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
        <Link href="/login" className="text-sm font-medium text-violet-600 hover:text-violet-700">
          ← Voltar ao login
        </Link>
        <div className="mb-7 mt-6">
          <h1 className="text-2xl font-bold text-gray-900">Recuperar senha</h1>
          <p className="mt-2 text-sm leading-6 text-gray-500">
            Informe seu e-mail e enviaremos instruções para criar uma nova senha, se houver uma conta cadastrada.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
          {sent && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700">Se existir uma conta com esse e-mail, enviaremos instruções. Verifique também a caixa de spam.</p>}

          <label className="block text-sm font-medium text-gray-700">
            E-mail
            <input
              required
              type="email"
              autoComplete="email"
              maxLength={254}
              className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
              placeholder="voce@email.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>

          <button
            type="submit"
            disabled={sending}
            className="w-full rounded-xl bg-violet-600 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-wait disabled:opacity-50"
          >
            {sending ? "Enviando..." : "Enviar instruções"}
          </button>
        </form>
      </section>
    </main>
  );
}
