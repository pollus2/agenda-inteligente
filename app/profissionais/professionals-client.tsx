"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import type { Professional } from "./types";

const inputClass =
  "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100";

function getLinkErrorMessage(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("add the professional account email")) {
    return "Cadastre o e-mail da conta no perfil profissional e tente novamente.";
  }
  if (normalized.includes("no confirmed auth account")) {
    return "Ainda não encontramos uma conta confirmada com esse e-mail. Confira se o profissional aceitou o convite e se o e-mail está igual nos dois cadastros.";
  }
  if (normalized.includes("already linked to another account")) {
    return "Este perfil já está vinculado a outra conta. Revise o cadastro antes de continuar.";
  }
  if (normalized.includes("already linked to another professional profile")) {
    return "Esta conta já está vinculada a outro perfil profissional deste estabelecimento.";
  }
  if (normalized.includes("already has another role")) {
    return "Esta conta já possui outro papel neste estabelecimento e não pode ser vinculada como profissional.";
  }
  if (normalized.includes("only establishment owners and managers")) {
    return "Somente o proprietário ou gerente pode vincular contas profissionais.";
  }
  if (normalized.includes("professional profile not found")) {
    return "O perfil profissional não foi encontrado. Atualize a página e tente novamente.";
  }

  return "Não foi possível vincular a conta agora. Confira o acesso ao Supabase e tente novamente.";
}

export default function ProfessionalsClient({
  establishmentId,
  canManage,
  professionals,
}: {
  establishmentId: string;
  canManage: boolean;
  professionals: Professional[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [changingStatusId, setChangingStatusId] = useState<string | null>(null);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    specialty: "",
  });

  const filteredProfessionals = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
    if (!normalizedQuery) return professionals;

    return professionals.filter((professional) =>
      [professional.name, professional.email, professional.phone, professional.specialty]
        .some((value) => value?.toLocaleLowerCase("pt-BR").includes(normalizedQuery))
    );
  }, [professionals, query]);

  const activeCount = professionals.filter((professional) => professional.active).length;

  function resetForm() {
    setForm({ name: "", phone: "", email: "", specialty: "" });
    setEditingId(null);
    setShowForm(false);
  }

  function startCreate() {
    setErrorMessage("");
    setSuccessMessage("");
    setForm({ name: "", phone: "", email: "", specialty: "" });
    setEditingId(null);
    setShowForm(true);
  }

  function startEdit(professional: Professional) {
    setErrorMessage("");
    setSuccessMessage("");
    setForm({
      name: professional.name,
      phone: professional.phone ?? "",
      email: professional.email ?? "",
      specialty: professional.specialty ?? "",
    });
    setEditingId(professional.id);
    setShowForm(true);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    const name = form.name.trim();
    if (!name) {
      setErrorMessage("Informe o nome do profissional.");
      return;
    }

    setSaving(true);

    try {
      const supabase = createClient();
      const professionalData = {
        name,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        specialty: form.specialty.trim() || null,
      };

      const result = editingId
        ? await supabase
            .from("professionals")
            .update(professionalData)
            .eq("id", editingId)
            .eq("establishment_id", establishmentId)
        : await supabase.from("professionals").insert({
            ...professionalData,
            establishment_id: establishmentId,
            active: true,
          });

      if (result.error) throw result.error;

      resetForm();
      setSuccessMessage(editingId ? "Profissional atualizado." : "Profissional cadastrado.");
      router.refresh();
    } catch {
      setErrorMessage("Não foi possível salvar. Confira sua conexão e tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(professional: Professional) {
    setErrorMessage("");
    setSuccessMessage("");
    setChangingStatusId(professional.id);

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("professionals")
        .update({ active: !professional.active })
        .eq("id", professional.id)
        .eq("establishment_id", establishmentId);

      if (error) throw error;

      setSuccessMessage(
        professional.active ? "Profissional desativado." : "Profissional ativado."
      );
      router.refresh();
    } catch {
      setErrorMessage("Não foi possível alterar o status. Tente novamente.");
    } finally {
      setChangingStatusId(null);
    }
  }

  async function linkAccount(professional: Professional) {
    setErrorMessage("");
    setSuccessMessage("");
    setLinkingId(professional.id);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("link_professional_user", {
        target_establishment_id: establishmentId,
        target_professional_id: professional.id,
      });
      if (error) throw error;
      setSuccessMessage(`Conta vinculada ao perfil de ${professional.name}.`);
      router.refresh();
    } catch (error) {
      const message =
        typeof error === "object" && error !== null && "message" in error &&
        typeof error.message === "string"
          ? error.message
          : "";
      setErrorMessage(getLinkErrorMessage(message));
    } finally {
      setLinkingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f8fc] text-slate-800">
      <div className="mx-auto max-w-6xl px-5 py-6 sm:px-8 sm:py-9">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link href="/" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
              ← Voltar ao dashboard
            </Link>
            <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Profissionais
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Organize as pessoas que atendem no seu estabelecimento.
            </p>
            {canManage && (
              <p className="mt-2 max-w-2xl text-xs text-slate-500">
                Para liberar o acesso, convide primeiro o e-mail pelo Supabase Auth. Depois que a pessoa aceitar, use “Vincular conta” neste perfil.
              </p>
            )}
          </div>
          {canManage && !showForm && (
            <button
              type="button"
              onClick={startCreate}
              className="rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
            >
              + Novo profissional
            </button>
          )}
        </header>

        {(errorMessage || successMessage) && (
          <div
            role={errorMessage ? "alert" : "status"}
            className={`mb-5 rounded-xl px-4 py-3 text-sm ${
              errorMessage
                ? "border border-rose-100 bg-rose-50 text-rose-700"
                : "border border-emerald-100 bg-emerald-50 text-emerald-700"
            }`}
          >
            {errorMessage || successMessage}
          </div>
        )}

        {showForm && (
          <section className="mb-7 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-7">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingId ? "Editar profissional" : "Cadastrar profissional"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">Os campos com * são obrigatórios.</p>
              </div>
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100"
              >
                Fechar
              </button>
            </div>

            <form onSubmit={handleSave} className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">
                Nome completo *
                <input
                  autoFocus
                  required
                  maxLength={120}
                  className={inputClass}
                  placeholder="Ex.: Ana Paula Souza"
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Especialidade
                <input
                  maxLength={120}
                  className={inputClass}
                  placeholder="Ex.: Cabeleireira"
                  value={form.specialty}
                  onChange={(event) => setForm({ ...form, specialty: event.target.value })}
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Telefone
                <input
                  type="tel"
                  maxLength={40}
                  className={inputClass}
                  placeholder="(11) 99999-9999"
                  value={form.phone}
                  onChange={(event) => setForm({ ...form, phone: event.target.value })}
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                E-mail
                <input
                  type="email"
                  maxLength={254}
                  className={inputClass}
                  placeholder="profissional@email.com"
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                />
              </label>
              <div className="flex justify-end gap-3 pt-2 sm:col-span-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-60"
                >
                  {saving ? "Salvando..." : editingId ? "Salvar alterações" : "Cadastrar"}
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="mb-5 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Total de profissionais</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{professionals.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Profissionais ativos</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{activeCount}</p>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-bold text-slate-900">Equipe</h2>
              <p className="mt-1 text-xs text-slate-400">{professionals.length} cadastrados</p>
            </div>
            <input
              type="search"
              aria-label="Buscar profissional"
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 sm:max-w-xs"
              placeholder="Buscar por nome ou especialidade"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          {filteredProfessionals.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                <span className="text-lg font-bold">+</span>
              </div>
              <h3 className="mt-4 font-semibold text-slate-800">
                {professionals.length === 0 ? "Sua equipe começa aqui" : "Nenhum profissional encontrado"}
              </h3>
              <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
                {professionals.length === 0
                  ? "Cadastre os profissionais do estabelecimento para organizar sua equipe."
                  : "Tente buscar por outro nome, e-mail ou especialidade."}
              </p>
              {canManage && professionals.length === 0 && !showForm && (
                <button
                  type="button"
                  onClick={startCreate}
                  className="mt-5 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
                >
                  Cadastrar primeiro profissional
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredProfessionals.map((professional) => (
                <article key={professional.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-sm font-bold text-indigo-700">
                      {professional.name
                        .split(/\s+/)
                        .slice(0, 2)
                        .map((part) => part[0])
                        .join("")
                        .toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate font-semibold text-slate-900">{professional.name}</h3>
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${professional.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                          {professional.active ? "Ativo" : "Inativo"}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-sm text-slate-500">
                        {[professional.specialty, professional.phone, professional.email]
                          .filter(Boolean)
                          .join(" · ") || "Sem especialidade ou contato informado"}
                      </p>
                      {canManage && professional.user_id && (
                        <span className="mt-2 inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
                          Conta de acesso vinculada
                        </span>
                      )}
                    </div>
                  </div>
                  {canManage && <div className="flex shrink-0 flex-wrap gap-2 sm:pl-4">
                    {!professional.user_id && (
                      <button
                        type="button"
                        onClick={() => void linkAccount(professional)}
                        disabled={!professional.email || linkingId === professional.id}
                        title={!professional.email ? "Cadastre o e-mail desta conta primeiro" : "Vincular conta de acesso"}
                        className="rounded-lg border border-indigo-200 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {linkingId === professional.id ? "Vinculando..." : "Vincular conta"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => startEdit(professional)}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => void toggleActive(professional)}
                      disabled={changingStatusId === professional.id}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
                    >
                      {changingStatusId === professional.id
                        ? "Atualizando..."
                        : professional.active
                          ? "Desativar"
                          : "Ativar"}
                    </button>
                  </div>}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
