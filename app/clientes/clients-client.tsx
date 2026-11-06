"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import type { ClientRecord } from "./types";

const inputClass =
  "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100";
const initialForm = { name: "", phone: "", email: "", birthDate: "", notes: "" };

export default function ClientsClient({
  establishmentId,
  canManage,
  clients,
}: {
  establishmentId: string;
  canManage: boolean;
  clients: ClientRecord[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [form, setForm] = useState(initialForm);

  const filteredClients = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    if (!normalized) return clients;
    return clients.filter((client) =>
      [client.name, client.email, client.phone]
        .some((value) => value?.toLocaleLowerCase("pt-BR").includes(normalized))
    );
  }, [clients, query]);

  function closeForm() {
    setForm(initialForm);
    setEditingId(null);
    setShowForm(false);
  }

  function startEdit(client: ClientRecord) {
    setErrorMessage("");
    setSuccessMessage("");
    setForm({
      name: client.name,
      phone: client.phone ?? "",
      email: client.email ?? "",
      birthDate: client.birth_date ?? "",
      notes: client.notes ?? "",
    });
    setEditingId(client.id);
    setShowForm(true);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");
    const name = form.name.trim();
    if (!name) return setErrorMessage("Informe o nome do cliente.");
    setSaving(true);
    try {
      const supabase = createClient();
      const clientData = {
        name,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        birth_date: form.birthDate || null,
        notes: form.notes.trim() || null,
      };
      const result = editingId
        ? await supabase.from("clients").update(clientData)
            .eq("id", editingId).eq("establishment_id", establishmentId)
        : await supabase.from("clients").insert({
            ...clientData,
            establishment_id: establishmentId,
          });
      if (result.error) throw result.error;
      closeForm();
      setSuccessMessage(editingId ? "Cliente atualizado." : "Cliente cadastrado.");
      router.refresh();
    } catch {
      setErrorMessage("Não foi possível salvar o cliente. Confira sua conexão e tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f8fc] text-slate-800">
      <div className="mx-auto max-w-6xl px-5 py-6 sm:px-8 sm:py-9">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link href="/" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">← Voltar ao dashboard</Link>
            <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Clientes</h1>
            <p className="mt-1 text-sm text-slate-500">Consulte e mantenha os contatos dos clientes do estabelecimento.</p>
          </div>
          {canManage && !showForm && <button type="button" onClick={() => { setErrorMessage(""); setSuccessMessage(""); setEditingId(null); setForm(initialForm); setShowForm(true); }} className="rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700">+ Novo cliente</button>}
        </header>

        {(errorMessage || successMessage) && <div role={errorMessage ? "alert" : "status"} className={`mb-5 rounded-xl px-4 py-3 text-sm ${errorMessage ? "border border-rose-100 bg-rose-50 text-rose-700" : "border border-emerald-100 bg-emerald-50 text-emerald-700"}`}>{errorMessage || successMessage}</div>}

        {showForm && (
          <section className="mb-7 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-7">
            <div className="mb-5 flex items-start justify-between gap-3"><div><h2 className="text-lg font-bold text-slate-900">{editingId ? "Editar cliente" : "Cadastrar cliente"}</h2><p className="mt-1 text-sm text-slate-500">O nome é obrigatório; os demais dados são opcionais.</p></div><button type="button" onClick={closeForm} className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100">Fechar</button></div>
            <form onSubmit={handleSave} className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">Nome completo *<input required autoFocus maxLength={160} className={inputClass} placeholder="Nome do cliente" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
              <label className="text-sm font-medium text-slate-700">Telefone<input type="tel" maxLength={40} className={inputClass} placeholder="(11) 99999-9999" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
              <label className="text-sm font-medium text-slate-700">E-mail<input type="email" maxLength={254} className={inputClass} placeholder="cliente@email.com" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
              <label className="text-sm font-medium text-slate-700">Data de nascimento<input type="date" className={inputClass} value={form.birthDate} onChange={(event) => setForm({ ...form, birthDate: event.target.value })} /></label>
              <label className="text-sm font-medium text-slate-700 sm:col-span-2">Observações<textarea rows={3} maxLength={2000} className={inputClass} placeholder="Preferências ou observações internas" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
              <div className="flex justify-end gap-3 pt-2 sm:col-span-2"><button type="button" onClick={closeForm} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancelar</button><button type="submit" disabled={saving} className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-60">{saving ? "Salvando..." : editingId ? "Salvar alterações" : "Cadastrar"}</button></div>
            </form>
          </section>
        )}

        <section className="mb-5 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Clientes cadastrados</p><p className="mt-2 text-2xl font-bold text-slate-900">{clients.length}</p></section>
        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-bold text-slate-900">Lista de clientes</h2><p className="mt-1 text-xs text-slate-400">{clients.length} cadastrados</p></div><input type="search" aria-label="Buscar cliente" className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 sm:max-w-xs" placeholder="Buscar por nome ou contato" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
          {filteredClients.length === 0 ? (
            <div className="px-6 py-14 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-lg font-bold text-indigo-600">+</div><h3 className="mt-4 font-semibold text-slate-800">{clients.length === 0 ? "Sua lista começa aqui" : "Nenhum cliente encontrado"}</h3><p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{clients.length === 0 ? "Cadastre clientes para facilitar os agendamentos e o atendimento." : "Tente outro nome, e-mail ou telefone."}</p>{canManage && clients.length === 0 && !showForm && <button type="button" onClick={() => setShowForm(true)} className="mt-5 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700">Cadastrar primeiro cliente</button>}</div>
          ) : (
            <div className="divide-y divide-slate-100">{filteredClients.map((client) => <article key={client.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-center gap-4"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-sm font-bold text-indigo-700">{client.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</div><div className="min-w-0"><h3 className="truncate font-semibold text-slate-900">{client.name}</h3><p className="mt-1 truncate text-sm text-slate-500">{[client.phone, client.email].filter(Boolean).join(" · ") || "Sem telefone ou e-mail informado"}</p></div></div>{canManage && <button type="button" onClick={() => startEdit(client)} className="self-start rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 sm:self-auto">Editar</button>}</article>)}</div>
          )}
        </section>
      </div>
    </main>
  );
}
