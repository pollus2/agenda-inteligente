
"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

export default function CadastroPage() {
  const [form, setForm] = useState({
    nome: "",
    email: "",
    senha: "",
    nomeEstabelecimento: "",
    telefone: "",
    tipoNegocio: "Barbearia",
  });

  
  const [carregando, setCarregando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");

  const [mostrarSenha, setMostrarSenha] = useState(false);

  function atualizarCampo(
    campo: string,
    valor: string
  ) {
    setForm((anterior) => ({
      ...anterior,
      [campo]: valor,
    }));
  }

 async function handleSubmit(event: React.FormEvent) {
  event.preventDefault();

  setCarregando(true);
  setMensagem("");
  setErro("");

  try {
    const supabase = createClient();

    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.senha,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: {
          full_name: form.nome,
          establishment_name: form.nomeEstabelecimento,
          phone: form.telefone,
          business_type: form.tipoNegocio,
        },
      },
    });

    if (error) {
      throw error;
    }

    setMensagem(
      "Conta criada! Acesse seu e-mail e confirme o cadastro para continuar."
    );
  } catch (error) {
    setErro(
      error instanceof Error
        ? error.message
        : "Não foi possível realizar o cadastro."
    );
  } finally {
    setCarregando(false);
  }
}

  const inputClass =
    "w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100";

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-600 text-xl font-bold text-white">
            A
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            Crie sua conta
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Cadastre seu negócio e comece a organizar seus agendamentos.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8"
        >
            {mensagem && (
  <div className="rounded-xl bg-green-50 p-4 text-sm text-green-700">
    {mensagem}
  </div>
)}

{erro && (
  <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
    {erro}
  </div>
)}
          <section>
            <h2 className="mb-4 text-base font-semibold text-gray-900">
              Seus dados
            </h2>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Nome completo
                </label>
                <input
                  required
                  className={inputClass}
                  placeholder="Seu nome"
                  value={form.nome}
                  onChange={(e) => atualizarCampo("nome", e.target.value)}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  E-mail
                </label>
                <input
                  required
                  type="email"
                  className={inputClass}
                  placeholder="voce@email.com"
                  value={form.email}
                  onChange={(e) => atualizarCampo("email", e.target.value)}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Senha
                </label>
                <div className="relative">
                  <input
                    required
                    minLength={8}
                    type={mostrarSenha ? "text" : "password"}
                    className={inputClass}
                    placeholder="Mínimo de 8 caracteres"
                    value={form.senha}
                    onChange={(e) => atualizarCampo("senha", e.target.value)}
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
            </div>
          </section>

          <div className="border-t border-gray-100" />

          <section>
            <h2 className="mb-4 text-base font-semibold text-gray-900">
              Dados do estabelecimento
            </h2>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Nome do negócio
                </label>
                <input
                  required
                  className={inputClass}
                  placeholder="Ex.: Barbearia Central"
                  value={form.nomeEstabelecimento}
                  onChange={(e) =>
                    atualizarCampo("nomeEstabelecimento", e.target.value)
                  }
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Telefone / WhatsApp
                </label>
                <input
                  required
                  type="tel"
                  className={inputClass}
                  placeholder="(19) 99999-9999"
                  value={form.telefone}
                  onChange={(e) => atualizarCampo("telefone", e.target.value)}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Tipo de negócio
                </label>
                <select
                  className={inputClass}
                  value={form.tipoNegocio}
                  onChange={(e) => atualizarCampo("tipoNegocio", e.target.value)}
                >
                  <option>Barbearia</option>
                  <option>Salão de beleza</option>
                  <option>Clínica</option>
                  <option>Estética</option>
                  <option>Personal trainer</option>
                  <option>Outro</option>
                </select>
              </div>
            </div>
          </section>

          <button
  type="submit"
  disabled={carregando}
  className="w-full rounded-xl bg-violet-600 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-50"
>
  {carregando ? "Criando sua conta..." : "Criar conta e estabelecimento"}
</button>

          <p className="text-center text-sm text-gray-500">
            Já tem uma conta?{" "}
            <Link
              href="/login"
              className="font-semibold text-violet-600 hover:text-violet-700"
            >
              Entrar
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
