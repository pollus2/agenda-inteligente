"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (!active) return;
      if (!user) {
        router.replace("/esqueci-senha");
        return;
      }
      setReady(true);
      setCheckingSession(false);
    }).catch(() => {
      if (active) {
        setError("Não foi possível validar o link. Solicite outra redefinição de senha.");
        setCheckingSession(false);
      }
    });

    return () => {
      active = false;
    };
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirmation) {
      setError("As senhas não coincidem.");
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setPassword("");
      setConfirmation("");
      setSaved(true);
    } catch {
      setError("Não foi possível atualizar a senha. Solicite um novo link e tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
        {checkingSession ? (
          <p role="status" className="text-center text-sm text-gray-500">Validando o link...</p>
        ) : saved ? (
          <>
            <h1 className="text-2xl font-bold text-gray-900">Senha atualizada</h1>
            <p role="status" className="mt-2 text-sm leading-6 text-gray-500">Sua nova senha já pode ser usada para entrar na Agenda Inteligente.</p>
            <button type="button" onClick={() => router.replace("/")} className="mt-6 w-full rounded-xl bg-violet-600 px-4 py-3.5 text-sm font-semibold text-white hover:bg-violet-700">
              Continuar para o app
            </button>
          </>
        ) : ready ? (
          <>
            <Link href="/login" className="text-sm font-medium text-violet-600 hover:text-violet-700">← Voltar ao login</Link>
            <div className="mb-7 mt-6">
              <h1 className="text-2xl font-bold text-gray-900">Criar nova senha</h1>
              <p className="mt-2 text-sm text-gray-500">Use pelo menos 8 caracteres.</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
              <label className="block text-sm font-medium text-gray-700">
                Nova senha
                <input required minLength={8} type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Confirmar nova senha
                <input required minLength={8} type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" />
              </label>
              <button type="submit" disabled={saving} className="w-full rounded-xl bg-violet-600 px-4 py-3.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:cursor-wait disabled:opacity-50">
                {saving ? "Salvando..." : "Salvar nova senha"}
              </button>
            </form>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold text-gray-900">Não foi possível validar o link</h1>
            <p role="alert" className="mt-2 text-sm leading-6 text-gray-500">{error || "O link expirou ou já foi utilizado. Solicite uma nova redefinição de senha."}</p>
            <Link href="/esqueci-senha" className="mt-6 inline-flex w-full justify-center rounded-xl bg-violet-600 px-4 py-3.5 text-sm font-semibold text-white hover:bg-violet-700">
              Solicitar novo link
            </Link>
          </>
        )}
      </section>
    </main>
  );
}
