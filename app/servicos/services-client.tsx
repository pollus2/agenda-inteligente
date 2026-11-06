"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import type { Service } from "./types";

const inputClass =
  "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100";

const initialForm = {
  name: "",
  description: "",
  category: "",
  duration: "30",
  buffer: "0",
  price: "0",
};

export default function ServicesClient({
  establishmentId,
  canManage,
  services,
}: {
  establishmentId: string;
  canManage: boolean;
  services: Service[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [changingStatusId, setChangingStatusId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [form, setForm] = useState(initialForm);

  const filteredServices = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    if (!normalized) return services;
    return services.filter((service) =>
      [service.name, service.category, service.description]
        .some((value) => value?.toLocaleLowerCase("pt-BR").includes(normalized))
    );
  }, [query, services]);
  const activeCount = services.filter((service) => service.active).length;

  function closeForm() {
    setForm(initialForm);
    setEditingId(null);
    setShowForm(false);
  }

  function startCreate() {
    setErrorMessage("");
    setSuccessMessage("");
    setForm(initialForm);
    setEditingId(null);
    setShowForm(true);
  }

  function startEdit(service: Service) {
    setErrorMessage("");
    setSuccessMessage("");
    setForm({
      name: service.name,
      description: service.description ?? "",
      category: service.category ?? "",
      duration: String(service.duration_minutes),
      buffer: String(service.buffer_minutes),
      price: String(service.price),
    });
    setEditingId(service.id);
    setShowForm(true);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    const name = form.name.trim();
    const duration = Number(form.duration);
    const buffer = Number(form.buffer);
    const price = Number(form.price.replace(",", "."));
    if (!name) return setErrorMessage("Informe o nome do serviço.");
    if (!Number.isInteger(duration) || duration < 1) {
      return setErrorMessage("A duração deve ser um número inteiro maior que zero.");
    }
    if (!Number.isInteger(buffer) || buffer < 0) {
      return setErrorMessage("O intervalo deve ser um número inteiro igual ou maior que zero.");
    }
    if (!Number.isFinite(price) || price < 0) {
      return setErrorMessage("Informe um preço válido, igual ou maior que zero.");
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const serviceData = {
        name,
        description: form.description.trim() || null,
        category: form.category.trim() || null,
        duration_minutes: duration,
        buffer_minutes: buffer,
        price,
      };
      const result = editingId
        ? await supabase.from("services").update(serviceData)
            .eq("id", editingId).eq("establishment_id", establishmentId)
        : await supabase.from("services").insert({
            ...serviceData,
            establishment_id: establishmentId,
            active: true,
          });
      if (result.error) throw result.error;

      closeForm();
      setSuccessMessage(editingId ? "Serviço atualizado." : "Serviço cadastrado.");
      router.refresh();
    } catch {
      setErrorMessage("Não foi possível salvar o serviço. Confira sua conexão e tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(service: Service) {
    setErrorMessage("");
    setSuccessMessage("");
    setChangingStatusId(service.id);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("services")
        .update({ active: !service.active })
        .eq("id", service.id)
        .eq("establishment_id", establishmentId);
      if (error) throw error;
      setSuccessMessage(service.active ? "Serviço desativado." : "Serviço ativado.");
      router.refresh();
    } catch {
      setErrorMessage("Não foi possível alterar o status do serviço. Tente novamente.");
    } finally {
      setChangingStatusId(null);
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
            <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Serviços</h1>
            <p className="mt-1 text-sm text-slate-500">Cadastre os serviços, duração e preço do estabelecimento.</p>
          </div>
          {canManage && !showForm && <button type="button" onClick={startCreate} className="rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700">+ Novo serviço</button>}
        </header>

        {(errorMessage || successMessage) && (
          <div role={errorMessage ? "alert" : "status"} className={`mb-5 rounded-xl px-4 py-3 text-sm ${errorMessage ? "border border-rose-100 bg-rose-50 text-rose-700" : "border border-emerald-100 bg-emerald-50 text-emerald-700"}`}>
            {errorMessage || successMessage}
          </div>
        )}

        {showForm && (
          <section className="mb-7 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-7">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{editingId ? "Editar serviço" : "Cadastrar serviço"}</h2>
                <p className="mt-1 text-sm text-slate-500">Informe os dados que aparecem na agenda e no cadastro de agendamentos.</p>
              </div>
              <button type="button" onClick={closeForm} className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100">Fechar</button>
            </div>
            <form onSubmit={handleSave} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <label className="text-sm font-medium text-slate-700">Nome do serviço *<input required maxLength={120} className={inputClass} placeholder="Ex.: Corte de cabelo" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
              <label className="text-sm font-medium text-slate-700">Categoria<input maxLength={100} className={inputClass} placeholder="Ex.: Cabelo" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} /></label>
              <label className="text-sm font-medium text-slate-700">Preço (R$) *<input required type="number" min="0" step="0.01" className={inputClass} value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} /></label>
              <label className="text-sm font-medium text-slate-700">Duração (minutos) *<input required type="number" min="1" step="1" className={inputClass} value={form.duration} onChange={(event) => setForm({ ...form, duration: event.target.value })} /></label>
              <label className="text-sm font-medium text-slate-700">Intervalo depois (minutos)<input required type="number" min="0" step="1" className={inputClass} value={form.buffer} onChange={(event) => setForm({ ...form, buffer: event.target.value })} /></label>
              <label className="text-sm font-medium text-slate-700 sm:col-span-2 lg:col-span-1">Descrição<textarea rows={2} maxLength={1000} className={inputClass} placeholder="Detalhes opcionais" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
              <div className="flex justify-end gap-3 pt-2 sm:col-span-2 lg:col-span-3">
                <button type="button" onClick={closeForm} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancelar</button>
                <button type="submit" disabled={saving} className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-60">{saving ? "Salvando..." : editingId ? "Salvar alterações" : "Cadastrar"}</button>
              </div>
            </form>
          </section>
        )}

        <section className="mb-5 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Total de serviços</p><p className="mt-2 text-2xl font-bold text-slate-900">{services.length}</p></div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Serviços ativos</p><p className="mt-2 text-2xl font-bold text-slate-900">{activeCount}</p></div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div><h2 className="font-bold text-slate-900">Catálogo</h2><p className="mt-1 text-xs text-slate-400">{services.length} cadastrados</p></div>
            <input type="search" aria-label="Buscar serviço" className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 sm:max-w-xs" placeholder="Buscar por nome ou categoria" value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
          {filteredServices.length === 0 ? (
            <div className="px-6 py-14 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-lg font-bold text-indigo-600">+</div><h3 className="mt-4 font-semibold text-slate-800">{services.length === 0 ? "Seu catálogo começa aqui" : "Nenhum serviço encontrado"}</h3><p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{services.length === 0 ? "Cadastre os serviços oferecidos pelo estabelecimento." : "Tente buscar outro nome, categoria ou descrição."}</p>{canManage && services.length === 0 && !showForm && <button type="button" onClick={startCreate} className="mt-5 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700">Cadastrar primeiro serviço</button>}</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredServices.map((service) => (
                <article key={service.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-slate-900">{service.name}</h3><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${service.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{service.active ? "Ativo" : "Inativo"}</span></div><p className="mt-1 truncate text-sm text-slate-500">{[service.category, `${service.duration_minutes} min`, service.buffer_minutes ? `+ ${service.buffer_minutes} min intervalo` : null, service.description].filter(Boolean).join(" · ")}</p></div>
                  <div className="flex shrink-0 items-center gap-2 sm:pl-4"><span className="mr-2 font-semibold text-slate-800">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(service.price)}</span>{canManage && <><button type="button" onClick={() => startEdit(service)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Editar</button><button type="button" onClick={() => void toggleActive(service)} disabled={changingStatusId === service.id} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60">{changingStatusId === service.id ? "Atualizando..." : service.active ? "Desativar" : "Ativar"}</button></>}</div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
