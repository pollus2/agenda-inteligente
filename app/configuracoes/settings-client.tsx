"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export default function SettingsClient({
  userName,
  userEmail,
  roleLabel,
  establishmentName,
  establishmentId,
  establishmentSlug,
  establishmentPhone,
  canManageEstablishment,
}: {
  userName: string;
  userEmail: string;
  roleLabel: string;
  establishmentName: string;
  establishmentId: string;
  establishmentSlug: string;
  establishmentPhone: string;
  canManageEstablishment: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState(userName);
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState("");
  const [nameSuccess, setNameSuccess] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [businessName, setBusinessName] = useState(establishmentName);
  const [businessSlug, setBusinessSlug] = useState(establishmentSlug);
  const [savedSlug, setSavedSlug] = useState(establishmentSlug);
  const [businessPhone, setBusinessPhone] = useState(establishmentPhone);
  const [savingBusiness, setSavingBusiness] = useState(false);
  const [businessError, setBusinessError] = useState("");
  const [businessSuccess, setBusinessSuccess] = useState("");
  const [bookingLinkCopied, setBookingLinkCopied] = useState(false);

  async function updateBusinessProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusinessError("");
    setBusinessSuccess("");
    const cleanName = businessName.trim();
    const cleanSlug = businessSlug.trim().toLowerCase();
    if (!cleanName || cleanName.length > 120) {
      setBusinessError("Informe um nome de estabelecimento com até 120 caracteres.");
      return;
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(cleanSlug) || cleanSlug.length > 60) {
      setBusinessError("Use no slug apenas letras minúsculas, números e hífens, sem espaços.");
      return;
    }

    setSavingBusiness(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("update_establishment_booking_profile", {
        target_establishment_id: establishmentId,
        target_name: cleanName,
        target_phone: businessPhone.trim() || null,
        target_slug: cleanSlug,
      });
      if (error) {
        if (error.message.toLowerCase().includes("slug already in use")) {
          setBusinessError("Esse endereço já está sendo usado por outro estabelecimento.");
          return;
        }
        throw error;
      }
      setBusinessName(cleanName);
      setBusinessSlug(cleanSlug);
      setSavedSlug(cleanSlug);
      setBusinessSuccess("Dados do estabelecimento atualizados.");
      router.refresh();
    } catch {
      setBusinessError("Não foi possível salvar os dados do estabelecimento. Tente novamente.");
    } finally {
      setSavingBusiness(false);
    }
  }

  async function copyBookingLink() {
    if (!savedSlug) return;
    const publicBookingUrl = `${window.location.origin}/agendar/${encodeURIComponent(savedSlug)}`;
    try {
      await navigator.clipboard.writeText(publicBookingUrl);
      setBookingLinkCopied(true);
      window.setTimeout(() => setBookingLinkCopied(false), 2500);
    } catch {
      window.prompt("Copie o link da página de agendamento:", publicBookingUrl);
    }
  }

  async function updateName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNameError("");
    setNameSuccess("");
    const cleanedName = name.trim();
    if (!cleanedName) {
      setNameError("Informe seu nome.");
      return;
    }

    setSavingName(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ data: { full_name: cleanedName } });
      if (error) throw error;
      setNameSuccess("Nome atualizado.");
      router.refresh();
    } catch {
      setNameError("Não foi possível atualizar seu nome. Tente novamente.");
    } finally {
      setSavingName(false);
    }
  }

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");
    if (password.length < 8) {
      setPasswordError("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirmation) {
      setPasswordError("As senhas não coincidem.");
      return;
    }

    setSavingPassword(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setPassword("");
      setConfirmation("");
      setPasswordSuccess("Senha atualizada com sucesso.");
    } catch {
      setPasswordError("Não foi possível atualizar a senha. Tente novamente.");
    } finally {
      setSavingPassword(false);
    }
  }

  const inputClass = "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100";

  return (
    <main className="min-h-screen bg-[#f7f8fc] text-slate-800">
      <div className="mx-auto max-w-4xl px-5 py-6 sm:px-8 sm:py-9">
        <header className="mb-8">
          <Link href="/" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">← Voltar ao dashboard</Link>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Configurações</h1>
          <p className="mt-1 text-sm text-slate-500">Gerencie seu perfil e as credenciais de acesso.</p>
        </header>

        <section className="mb-6 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-7">
          <div className="mb-5">
            <h2 className="font-bold text-slate-900">Seu acesso</h2>
            <p className="mt-1 text-sm text-slate-500">{establishmentName} · {roleLabel}</p>
          </div>
          <form onSubmit={updateName} className="max-w-xl space-y-4">
            {nameError && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{nameError}</p>}
            {nameSuccess && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{nameSuccess}</p>}
            <label className="block text-sm font-medium text-slate-700">
              Nome
              <input required maxLength={120} autoComplete="name" className={inputClass} value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              E-mail
              <input readOnly aria-describedby="email-help" className={`${inputClass} bg-slate-50 text-slate-500`} value={userEmail} />
              <span id="email-help" className="mt-1 block text-xs font-normal text-slate-400">A troca de e-mail exige confirmação da caixa antiga e da nova.</span>
            </label>
            <button type="submit" disabled={savingName} className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-50">
              {savingName ? "Salvando..." : "Salvar nome"}
            </button>
          </form>
        </section>

        <section className="mb-6 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-7">
          <div className="mb-5">
            <h2 className="font-bold text-slate-900">Página pública de agendamento</h2>
            <p className="mt-1 text-sm text-slate-500">Edite como seu estabelecimento aparece e compartilhe o link com seus clientes.</p>
          </div>
          {canManageEstablishment ? (
            <form onSubmit={updateBusinessProfile} className="max-w-xl space-y-4">
              {businessError && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{businessError}</p>}
              {businessSuccess && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{businessSuccess}</p>}
              <label className="block text-sm font-medium text-slate-700">Nome do estabelecimento
                <input required maxLength={120} className={inputClass} value={businessName} onChange={(event) => setBusinessName(event.target.value)} />
              </label>
              <label className="block text-sm font-medium text-slate-700">Endereço curto do link
                <div className="mt-1.5 flex overflow-hidden rounded-xl border border-slate-200 focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-100">
                  <span className="flex items-center bg-slate-50 px-3 text-xs text-slate-500">/agendar/</span>
                  <input required maxLength={60} pattern="[a-z0-9]+(-[a-z0-9]+)*" className="min-w-0 flex-1 px-3 py-3 text-sm text-slate-800 outline-none" value={businessSlug} onChange={(event) => setBusinessSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/-{2,}/g, "-"))} />
                </div>
                <span className="mt-1 block text-xs font-normal text-slate-400">Somente letras sem acento, números e hífens. Alterar o endereço invalida o link antigo.</span>
              </label>
              <label className="block text-sm font-medium text-slate-700">Telefone do estabelecimento <span className="font-normal text-slate-400">(opcional)</span>
                <input type="tel" maxLength={40} autoComplete="tel" className={inputClass} value={businessPhone} onChange={(event) => setBusinessPhone(event.target.value)} />
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <button type="submit" disabled={savingBusiness} className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-50">{savingBusiness ? "Salvando..." : "Salvar dados públicos"}</button>
                {savedSlug && <button type="button" onClick={copyBookingLink} disabled={businessSlug !== savedSlug} title={businessSlug !== savedSlug ? "Salve o endereço antes de copiar o link" : undefined} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">{bookingLinkCopied ? "Link copiado" : "Copiar link"}</button>}
              </div>
            </form>
          ) : (
            <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
              <p>{businessName}</p>
              {businessSlug ? <a className="mt-1 inline-block text-indigo-600 underline" href={`/agendar/${encodeURIComponent(businessSlug)}`}>Abrir página de agendamento</a> : <p className="mt-1 text-slate-500">O link público ainda não foi configurado.</p>}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-7">
          <div className="mb-5">
            <h2 className="font-bold text-slate-900">Alterar senha</h2>
            <p className="mt-1 text-sm text-slate-500">Use pelo menos 8 caracteres.</p>
          </div>
          <form onSubmit={updatePassword} className="max-w-xl space-y-4">
            {passwordError && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{passwordError}</p>}
            {passwordSuccess && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{passwordSuccess}</p>}
            <label className="block text-sm font-medium text-slate-700">
              Nova senha
              <input required minLength={8} type="password" autoComplete="new-password" className={inputClass} value={password} onChange={(event) => setPassword(event.target.value)} />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Confirmar nova senha
              <input required minLength={8} type="password" autoComplete="new-password" className={inputClass} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
            </label>
            <button type="submit" disabled={savingPassword} className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-wait disabled:opacity-50">
              {savingPassword ? "Salvando..." : "Alterar senha"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
