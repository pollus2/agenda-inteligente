"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";

type Establishment = { name: string; slug: string; timezone: string; phone: string | null };
type Professional = { id: string; name: string; specialty: string | null };
type Service = { id: string; name: string; category: string | null; description: string | null; duration_minutes: number; buffer_minutes: number; price: number };
type Slot = { time: string; start_at: string };

export type PublicBookingData = {
  establishment: Establishment;
  professionals: Professional[];
  services: Service[];
};

export default function PublicBookingClient({ data, initialDate }: { data: PublicBookingData; initialDate: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [serviceId, setServiceId] = useState(data.services[0]?.id ?? "");
  const [professionalId, setProfessionalId] = useState(data.professionals[0]?.id ?? "");
  const [date, setDate] = useState(initialDate);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotStart, setSlotStart] = useState("");
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [success, setSuccess] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const selectedService = data.services.find((service) => service.id === serviceId);
  const establishmentPhoneDigits = (data.establishment.phone ?? "").replace(/\D/g, "");
  const maxDate = useMemo(() => {
    const [year, month, day] = initialDate.split("-").map(Number);
    const limit = new Date(Date.UTC(year, month - 1, day + 120));
    return `${limit.getUTCFullYear()}-${String(limit.getUTCMonth() + 1).padStart(2, "0")}-${String(limit.getUTCDate()).padStart(2, "0")}`;
  }, [initialDate]);

  useEffect(() => {
    let cancelled = false;
    async function loadSlots() {
      setLoadingSlots(true);
      setErrorMessage("");
      setSlotStart("");
      const { data: result, error } = await supabase.rpc("get_public_available_slots", {
        target_slug: data.establishment.slug,
        target_professional_id: professionalId,
        target_service_id: serviceId,
        target_date: date,
      });
      if (cancelled) return;
      if (error) {
        setSlots([]);
        setErrorMessage("Não foi possível carregar os horários. Tente novamente.");
      } else {
        setSlots((result ?? []) as Slot[]);
      }
      setLoadingSlots(false);
    }
    if (serviceId && professionalId && date) void loadSlots();
    return () => { cancelled = true; };
  }, [data.establishment.slug, date, professionalId, serviceId, supabase]);

  async function submitBooking(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    if (!slotStart) {
      setErrorMessage("Selecione um horário disponível.");
      return;
    }
    setSubmitting(true);
    const { data: result, error } = await supabase.rpc("create_public_appointment", {
      target_slug: data.establishment.slug,
      target_client_name: name,
      target_client_phone: phone,
      target_client_email: email || null,
      target_professional_id: professionalId,
      target_service_id: serviceId,
      target_start_at: slotStart,
      target_notes: notes || null,
    });
    if (error) {
      setSubmitting(false);
      setErrorMessage(error.message.includes("no longer available")
        ? "Esse horário acabou de ser ocupado. Escolha outro horário."
        : "Não foi possível concluir o agendamento. Confira os dados e tente novamente.");
      setSlotStart("");
      return;
    }
    const booking = result as { start_at: string; status: string };
    const confirmedDate = new Intl.DateTimeFormat("pt-BR", {
      timeZone: data.establishment.timezone,
      dateStyle: "full",
      timeStyle: "short",
    }).format(new Date(booking.start_at));
    setSubmitting(false);
    setSuccess(`Solicitação enviada para ${confirmedDate}. O estabelecimento confirmará seu horário.`);
  }

  const inputClass = "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

  if (success) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-5">
        <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-700">✓</div>
          <h1 className="mt-5 text-2xl font-bold text-slate-900">Pedido de agendamento enviado</h1>
          <p className="mt-3 text-slate-600">{success}</p>
          <p className="mt-5 text-sm text-slate-500">{data.establishment.name}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-slate-50 to-violet-50 px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <header className="mb-7 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-indigo-600">Agendamento online</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{data.establishment.name}</h1>
          <p className="mt-2 text-slate-600">Escolha o serviço, profissional e horário que funcionam para você.</p>
          {data.establishment.phone && <a href={`tel:${establishmentPhoneDigits}`} className="mt-3 inline-flex text-sm font-medium text-indigo-700 hover:text-indigo-900">Dúvidas? Fale com o estabelecimento: {data.establishment.phone}</a>}
        </header>
        <form onSubmit={submitBooking} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xl shadow-indigo-100/40 sm:p-8">
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700">Serviço
              <select className={inputClass} value={serviceId} onChange={(event) => setServiceId(event.target.value)}>
                {data.services.map((service) => <option key={service.id} value={service.id}>{service.name} · R$ {Number(service.price).toFixed(2).replace(".", ",")}</option>)}
              </select>
              {selectedService && <span className="mt-1 block text-xs font-normal text-slate-500">{selectedService.duration_minutes} min{selectedService.description ? ` · ${selectedService.description}` : ""}</span>}
            </label>
            <label className="text-sm font-semibold text-slate-700">Profissional
              <select className={inputClass} value={professionalId} onChange={(event) => setProfessionalId(event.target.value)}>
                {data.professionals.map((professional) => <option key={professional.id} value={professional.id}>{professional.name}{professional.specialty ? ` · ${professional.specialty}` : ""}</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Data
              <input className={inputClass} type="date" min={initialDate} max={maxDate} value={date} onChange={(event) => setDate(event.target.value)} required />
            </label>
          </div>

          <fieldset className="mt-6">
            <legend className="text-sm font-semibold text-slate-700">Horários disponíveis</legend>
            {loadingSlots ? <p className="mt-3 text-sm text-slate-500">Buscando horários...</p> : slots.length ? (
              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
                {slots.map((slot) => <button key={slot.start_at} type="button" onClick={() => setSlotStart(slot.start_at)} className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${slotStart === slot.start_at ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 text-slate-700 hover:border-indigo-400 hover:bg-indigo-50"}`}>{slot.time}</button>)}
              </div>
            ) : <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-500">Nenhum horário disponível nesta data. Escolha outro dia.</p>}
          </fieldset>

          <div className="mt-7 border-t border-slate-100 pt-6">
            <h2 className="text-lg font-bold text-slate-900">Seus dados</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Nome completo<input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} maxLength={160} autoComplete="name" required /></label>
              <label className="text-sm font-semibold text-slate-700">Celular<input className={inputClass} type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} maxLength={40} autoComplete="tel" required /></label>
              <label className="text-sm font-semibold text-slate-700">E-mail <span className="font-normal text-slate-400">(opcional)</span><input className={inputClass} type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} autoComplete="email" /></label>
              <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Observações <span className="font-normal text-slate-400">(opcional)</span><textarea className={inputClass} value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={1000} rows={3} /></label>
            </div>
          </div>

          {errorMessage && <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{errorMessage}</p>}
          <button type="submit" disabled={submitting || loadingSlots || !slotStart} className="mt-6 w-full rounded-xl bg-indigo-600 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300">{submitting ? "Enviando..." : "Solicitar agendamento"}</button>
          <p className="mt-3 text-center text-xs text-slate-400">O horário ficará pendente até a confirmação do estabelecimento.</p>
        </form>
      </div>
    </main>
  );
}
