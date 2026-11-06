
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();

    setCarregando(true);
    setErro("");

    try {
      const supabase = createClient();

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: senha,
      });

      if (error) {
        throw error;
      }

      router.push("/");
      router.refresh();
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível entrar na sua conta."
      );
    } finally {
      setCarregando(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100";

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-600 text-xl font-bold text-white">
            A
          </div>

          <h1 className="text-2xl font-bold text-gray-900">
            Bem-vindo de volta!
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            Entre na sua conta para gerenciar seus agendamentos.
          </p>
        </div>

        <form
          onSubmit={handleLogin}
          className="space-y-5 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8"
        >
          {erro && (
            <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
              {erro}
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              E-mail
            </label>

            <input
              required
              type="email"
              autoComplete="email"
              className={inputClass}
              placeholder="voce@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Senha
            </label>

            <div className="relative">
              <input
                required
                type={mostrarSenha ? "text" : "password"}
                autoComplete="current-password"
                className={inputClass}
                placeholder="Digite sua senha"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
              />

              <button
                type="button"
                onClick={() => setMostrarSenha(!mostrarSenha)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-violet-600"
              >
                {mostrarSenha ? "Ocultar" : "Mostrar"}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={carregando}
            className="w-full rounded-xl bg-violet-600 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-50"
          >
            {carregando ? "Entrando..." : "Entrar na minha conta"}
          </button>

          <p className="text-center text-sm text-gray-500">
            Ainda não tem uma conta?{" "}
            <Link
              href="/cadastro"
              className="font-semibold text-violet-600 hover:text-violet-700"
            >
              Criar conta
            </Link>
          </p>
          <p className="text-center text-sm">
            <Link
              href="/esqueci-senha"
              className="font-semibold text-violet-600 hover:text-violet-700"
            >
              Esqueci minha senha
            </Link>
          </p>
        </form>

        <p className="mt-6 text-center text-xs text-gray-400">
          Agenda Inteligente · Gestão simples para o seu negócio
        </p>
      </div>
    </main>
  );
}
