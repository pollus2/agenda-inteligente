"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import type {
  Appointment,
  AppointmentClient,
  AppointmentProfessional,
  AppointmentService,
  BusinessHours,
} from "./types";

const fieldClass = "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100";
const statuses = ["pending", "confirmed", "in_progress", "completed", "cancelled", "no_show"] as const;
const statusLabels: Record<string, string> = {
  pending: "Pendente", confirmed: "Confirmado", in_progress: "Em andamento",
  completed: "Concluído", cancelled: "Cancelado", no_show: "Não compareceu",
};
const blockingStatuses = new Set(["pending", "confirmed", "in_progress"]);
const weekdays = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
const defaultSchedule = () => weekdays.map((_, weekday) => ({ weekday, isDayOff: true, startTime: "09:00", endTime: "17:00" }));

export default function AgendaClient({
  establishmentId, role, userId, currentTime, timezone, appointments, clients, professionals, services, businessHours,
}: {
  establishmentId: string;
  role: string;
  userId: string;
  currentTime: string;
  timezone: string;
  appointments: Appointment[];
  clients: AppointmentClient[];
  professionals: AppointmentProfessional[];
  services: AppointmentService[];
  businessHours: BusinessHours[];
}) {
  const router = useRouter();
  const canManage = role === "owner" || role === "manager";
  const today = dateKeyAt(new Date(), timezone);
  const [selectedDate, setSelectedDate] = useState(today);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [changingId, setChangingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [whatsAppLink, setWhatsAppLink] = useState("");
  const [showHoursEditor, setShowHoursEditor] = useState(false);
  const [hoursProfessionalId, setHoursProfessionalId] = useState(professionals.find((item) => item.active)?.id ?? "");
  const [schedule, setSchedule] = useState(defaultSchedule);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [form, setForm] = useState({ clientId: "", professionalId: "", serviceId: "", time: "", notes: "" });

  const dateAppointments = useMemo(
    () => appointments.filter((item) => dateKeyAt(new Date(item.start_at), timezone) === selectedDate),
    [appointments, selectedDate, timezone],
  );
  const activeServices = services.filter((service) => service.active);
  const activeProfessionals = professionals.filter((professional) => professional.active);
  const selectedService = activeServices.find((service) => service.id === form.serviceId);
  const selectedProfessional = professionals.find((professional) => professional.id === form.professionalId);
  const hoursForDay = businessHours.find((hours) =>
    hours.professional_id === form.professionalId && hours.weekday === weekday(selectedDate),
  );
  const hasSchedule = businessHours.some((hours) => hours.professional_id === form.professionalId);
  const slots = (() => {
    if (!hoursForDay || hoursForDay.is_day_off || !selectedService || !form.professionalId) return [];
    const openMinute = clockMinutes(hoursForDay.start_time);
    const closeMinute = clockMinutes(hoursForDay.end_time);
    const durationWithBuffer = selectedService.duration_minutes + selectedService.buffer_minutes;
    const step = 15;
    const current = new Date();
    const todayKey = dateKeyAt(current, timezone);
    const [currentHour, currentMinute] = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).format(current).split(":").map(Number);
    const nowMinute = currentHour * 60 + currentMinute;

    const choices: string[] = [];
    for (let start = openMinute; start + durationWithBuffer <= closeMinute; start += step) {
      if (selectedDate === todayKey && start <= nowMinute) continue;
      const slotStart = zonedDateTimeToIso(selectedDate, minutesToClock(start), timezone);
      const slotEndWithBuffer = zonedDateTimeToIso(selectedDate, minutesToClock(start + durationWithBuffer), timezone);
      const overlaps = appointments.some((appointment) =>
        appointment.professional_id === form.professionalId &&
        appointment.id !== editingId &&
        blockingStatuses.has(appointment.status) &&
        new Date(appointment.start_at).getTime() < new Date(slotEndWithBuffer).getTime() &&
        new Date(appointment.end_at).getTime() + (services.find((service) => service.id === appointment.service_id)?.buffer_minutes ?? 0) * 60000 > new Date(slotStart).getTime(),
      );
      if (!overlaps) choices.push(minutesToClock(start));
    }
    return choices;
  })();

  function beginCreate() {
    setErrorMessage("");
    setSuccessMessage("");
    setEditingId(null);
    setForm({ clientId: "", professionalId: activeProfessionals[0]?.id ?? "", serviceId: "", time: "", notes: "" });
    setShowForm(true);
  }

  function canEditAppointment(appointment: Appointment) {
    return new Date(appointment.start_at).getTime() > new Date(currentTime).getTime() &&
      professionals.some((professional) => professional.id === appointment.professional_id && professional.active) &&
      services.some((service) => service.id === appointment.service_id && service.active);
  }

  function beginEdit(appointment: Appointment) {
    const appointmentProfessional = professionals.find((professional) => professional.id === appointment.professional_id);
    const appointmentService = services.find((service) => service.id === appointment.service_id);
    if (!appointmentProfessional?.active || !appointmentService?.active || new Date(appointment.start_at) <= new Date(currentTime)) {
      setErrorMessage("Somente agendamentos futuros com profissional e serviço ativos podem ser editados.");
      return;
    }
    setErrorMessage("");
    setSuccessMessage("");
    setSelectedDate(dateKeyAt(new Date(appointment.start_at), timezone));
    setEditingId(appointment.id);
    setForm({
      clientId: appointment.client_id,
      professionalId: appointment.professional_id,
      serviceId: appointment.service_id,
      time: new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(appointment.start_at)),
      notes: appointment.notes ?? "",
    });
    setShowForm(true);
  }

  function closeAppointmentForm() {
    setShowForm(false);
    setEditingId(null);
  }

  function openHoursEditor(professionalId = hoursProfessionalId || activeProfessionals[0]?.id || "") {
    setHoursProfessionalId(professionalId);
    setSchedule(defaultSchedule().map((day) => {
      const stored = businessHours.find((hours) => hours.professional_id === professionalId && hours.weekday === day.weekday);
      return stored
        ? { ...day, isDayOff: stored.is_day_off, startTime: stored.start_time.slice(0, 5), endTime: stored.end_time.slice(0, 5) }
        : day;
    }));
    setErrorMessage("");
    setSuccessMessage("");
    setShowHoursEditor(true);
  }

  async function saveSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");
    if (!hoursProfessionalId) {
      setErrorMessage("Cadastre um profissional ativo antes de definir horários.");
      return;
    }
    const invalid = schedule.find((day) => !day.isDayOff && day.startTime >= day.endTime);
    if (invalid) {
      setErrorMessage(`O horário de início precisa ser anterior ao fim em ${weekdays[invalid.weekday]}.`);
      return;
    }
    setSavingSchedule(true);
    try {
      const supabase = createClient();
      const rows = schedule.map((day) => ({
        establishment_id: establishmentId,
        professional_id: hoursProfessionalId,
        weekday: day.weekday,
        start_time: day.startTime,
        end_time: day.endTime,
        is_day_off: day.isDayOff,
      }));
      const { error } = await supabase.from("business_hours")
        .upsert(rows, { onConflict: "professional_id,weekday" });
      if (error) throw error;
      setShowHoursEditor(false);
      setSuccessMessage("Horários de atendimento salvos.");
      router.refresh();
    } catch {
      setErrorMessage("Não foi possível salvar os horários. Tente novamente.");
    } finally {
      setSavingSchedule(false);
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");
    if (!form.clientId || !selectedProfessional || !selectedService || !form.time) {
      setErrorMessage("Selecione cliente, profissional, serviço e horário disponível.");
      return;
    }
    const originalAppointment = editingId ? appointments.find((appointment) => appointment.id === editingId) : null;
    const professionalWasDeactivated = !selectedProfessional.active && originalAppointment?.professional_id !== selectedProfessional.id;
    const serviceWasDeactivated = !selectedService.active && originalAppointment?.service_id !== selectedService.id;
    if (professionalWasDeactivated || serviceWasDeactivated) {
      setErrorMessage("Escolha um profissional e um serviço que estejam ativos.");
      return;
    }
    if (!hoursForDay || hoursForDay.is_day_off) {
      setErrorMessage("O profissional não tem expediente cadastrado para esse dia.");
      return;
    }

    const startAt = zonedDateTimeToIso(selectedDate, form.time, timezone);
    const endAt = zonedDateTimeToIso(selectedDate, minutesToClock(clockMinutes(form.time) + selectedService.duration_minutes), timezone);
    const blockEnd = zonedDateTimeToIso(selectedDate, minutesToClock(clockMinutes(form.time) + selectedService.duration_minutes + selectedService.buffer_minutes), timezone);
    if (new Date(startAt).getTime() < new Date().getTime()) {
      setErrorMessage("Não é possível criar um agendamento em um horário que já passou.");
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();
      // Recheck on save to catch appointments added after this page loaded.
      let conflictQuery = supabase
        .from("appointments")
        .select("id, start_at, end_at, service_id")
        .eq("establishment_id", establishmentId)
        .eq("professional_id", selectedProfessional.id)
        .in("status", ["pending", "confirmed", "in_progress"])
        .gte("start_at", new Date(new Date(startAt).getTime() - 86400000).toISOString())
        .lt("start_at", blockEnd);
      if (editingId) conflictQuery = conflictQuery.neq("id", editingId);
      const { data: conflicts, error: conflictError } = await conflictQuery;
      if (conflictError) throw conflictError;
      const hasConflict = conflicts?.some((appointment) => {
        const previousBuffer = services.find((service) => service.id === appointment.service_id)?.buffer_minutes ?? 0;
        const previousEnd = new Date(appointment.end_at).getTime() + previousBuffer * 60000;
        return new Date(appointment.start_at).getTime() < new Date(blockEnd).getTime() && previousEnd > new Date(startAt).getTime();
      });
      if (hasConflict) {
        setErrorMessage("Esse horário acabou de ser ocupado. Escolha outro horário disponível.");
        router.refresh();
        return;
      }

      const appointmentData = {
        client_id: form.clientId,
        professional_id: selectedProfessional.id,
        service_id: selectedService.id,
        start_at: startAt,
        end_at: endAt,
        price: selectedService.price,
        notes: form.notes.trim() || null,
      };
      const { error } = editingId
        ? await supabase.from("appointments").update(appointmentData).eq("id", editingId).eq("establishment_id", establishmentId)
        : await supabase.from("appointments").insert({
            ...appointmentData,
            establishment_id: establishmentId,
            status: "pending",
            created_by: userId,
          });
      if (error) throw error;
      setShowForm(false);
      setSuccessMessage(editingId ? "Agendamento atualizado." : "Agendamento criado como pendente.");
      setEditingId(null);
      setForm({ ...form, time: "" });
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error && error.message.includes("no longer available")
        ? "Esse horário acabou de ser ocupado. Escolha outro horário disponível."
        : "Não foi possível salvar o agendamento. Confira os dados e tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(appointment: Appointment, status: typeof statuses[number]) {
    setErrorMessage("");
    setSuccessMessage("");
    setWhatsAppLink("");
    setChangingId(appointment.id);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("appointments").update({ status })
        .eq("id", appointment.id).eq("establishment_id", establishmentId);
      if (error) throw error;
      let emailMessage = "";
      if (status === "confirmed" || status === "cancelled") {
        try {
          const response = await fetch("/api/appointments/notify-client", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ appointmentId: appointment.id, status }),
          });
          const result = await response.json() as { sent?: boolean; reason?: string };
          if (result.sent) emailMessage = " Aviso enviado por e-mail.";
          else if (result.reason === "not_configured") emailMessage = " O envio automático por e-mail ainda não está configurado.";
          else if (result.reason === "missing_email") emailMessage = " O cliente não tem e-mail cadastrado.";
          else emailMessage = " Não foi possível enviar o e-mail; você ainda pode avisar pelo WhatsApp.";
        } catch {
          emailMessage = " Não foi possível enviar o e-mail; você ainda pode avisar pelo WhatsApp.";
        }
      }
      if (status === "confirmed" || status === "cancelled") {
        const client = clients.find((item) => item.id === appointment.client_id);
        const phone = (client?.phone ?? "").replace(/\D/g, "");
        if (phone.length >= 10) {
          const internationalPhone = phone.startsWith("55") ? phone : `55${phone}`;
          const dateLabel = new Intl.DateTimeFormat("pt-BR", {
            timeZone: timezone,
            dateStyle: "full",
          }).format(new Date(appointment.start_at));
          const timeLabel = formatTime(appointment.start_at, timezone);
          const serviceName = services.find((item) => item.id === appointment.service_id)?.name ?? "serviço";
          const professionalName = professionals.find((item) => item.id === appointment.professional_id)?.name;
          const greeting = status === "confirmed"
            ? `Olá, ${client?.name}! Seu agendamento foi confirmado.`
            : `Olá, ${client?.name}. Seu agendamento foi cancelado.`;
          const message = `${greeting}\n\n${serviceName}${professionalName ? ` com ${professionalName}` : ""}\n${dateLabel} às ${timeLabel}.`;
          setWhatsAppLink(`https://wa.me/${internationalPhone}?text=${encodeURIComponent(message)}`);
          setSuccessMessage(`Status atualizado para ${statusLabels[status]}.${emailMessage} Envie também uma mensagem pelo WhatsApp, se desejar.`);
        } else {
          setSuccessMessage(`Status atualizado para ${statusLabels[status]}.${emailMessage} O cliente não tem um telefone válido cadastrado.`);
        }
      } else {
        setSuccessMessage("Status do agendamento atualizado.");
      }
      router.refresh();
    } catch {
      setErrorMessage("Não foi possível atualizar o status. Tente novamente.");
    } finally {
      setChangingId(null);
    }
  }

  const clientNames = new Map(clients.map((client) => [client.id, client.name]));
  const professionalNames = new Map(professionals.map((professional) => [professional.id, professional.name]));
  const serviceNames = new Map(services.map((service) => [service.id, service.name]));

  return (
    <main className="min-h-screen bg-[#f7f8fc] text-slate-800">
      <div className="mx-auto max-w-6xl px-5 py-6 sm:px-8 sm:py-9">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div><Link href="/" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">← Voltar ao dashboard</Link><h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Agenda</h1><p className="mt-1 text-sm text-slate-500">Agendamentos reais do estabelecimento · {timezone}</p></div>
          <div className="flex flex-wrap gap-2">{canManage && !showHoursEditor && <button type="button" onClick={() => openHoursEditor()} disabled={!activeProfessionals.length} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">Definir horários</button>}{canManage && !showForm && <button type="button" onClick={beginCreate} className="rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700">+ Novo agendamento</button>}</div>
        </header>

        {(errorMessage || successMessage) && <div role={errorMessage ? "alert" : "status"} className={`mb-5 rounded-xl px-4 py-3 text-sm ${errorMessage ? "border border-rose-100 bg-rose-50 text-rose-700" : "border border-emerald-100 bg-emerald-50 text-emerald-700"}`}>
          <p>{errorMessage || successMessage}</p>
          {whatsAppLink && <a href={whatsAppLink} target="_blank" rel="noreferrer" className="mt-3 inline-flex rounded-lg bg-emerald-600 px-3 py-2 font-semibold text-white hover:bg-emerald-700">Abrir mensagem no WhatsApp</a>}
        </div>}

        {canManage && showHoursEditor && <section className="mb-7 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-7"><div className="mb-5 flex items-start justify-between gap-3"><div><h2 className="text-lg font-bold text-slate-900">Horários de atendimento</h2><p className="mt-1 text-sm text-slate-500">Defina um período de expediente por dia da semana para cada profissional.</p></div><button type="button" onClick={() => setShowHoursEditor(false)} className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100">Fechar</button></div>
          <form onSubmit={saveSchedule} className="space-y-4">
            <label className="block max-w-md text-sm font-medium text-slate-700">Profissional<select className={fieldClass} value={hoursProfessionalId} onChange={(event) => openHoursEditor(event.target.value)}>{activeProfessionals.map((professional) => <option key={professional.id} value={professional.id}>{professional.name}</option>)}</select></label>
            <div className="divide-y divide-slate-100 rounded-xl border border-slate-100">{schedule.map((day) => <div key={day.weekday} className="grid items-center gap-3 p-3 sm:grid-cols-[1fr_120px_1fr_1fr]"><span className="text-sm font-medium text-slate-700">{weekdays[day.weekday]}</span><label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={day.isDayOff} onChange={(event) => setSchedule((current) => current.map((item) => item.weekday === day.weekday ? { ...item, isDayOff: event.target.checked } : item))} /> Folga</label><label className="text-xs text-slate-500">Início<input aria-label={`Início ${weekdays[day.weekday]}`} type="time" disabled={day.isDayOff} value={day.startTime} onChange={(event) => setSchedule((current) => current.map((item) => item.weekday === day.weekday ? { ...item, startTime: event.target.value } : item))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50" /></label><label className="text-xs text-slate-500">Fim<input aria-label={`Fim ${weekdays[day.weekday]}`} type="time" disabled={day.isDayOff} value={day.endTime} onChange={(event) => setSchedule((current) => current.map((item) => item.weekday === day.weekday ? { ...item, endTime: event.target.value } : item))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50" /></label></div>)}</div>
            <div className="flex justify-end gap-3"><button type="button" onClick={() => setShowHoursEditor(false)} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancelar</button><button type="submit" disabled={savingSchedule || !activeProfessionals.length} className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">{savingSchedule ? "Salvando..." : "Salvar horários"}</button></div>
          </form>
        </section>}

        {canManage && showForm && <section className="mb-7 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-7"><div className="mb-5 flex items-start justify-between gap-3"><div><h2 className="text-lg font-bold text-slate-900">{editingId ? "Editar agendamento" : "Novo agendamento"}</h2><p className="mt-1 text-sm text-slate-500">Os horários consideram expediente, duração, intervalo e compromissos ativos.</p></div><button type="button" onClick={closeAppointmentForm} className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100">Fechar</button></div>
          {(!clients.length || !activeProfessionals.length || !activeServices.length) && <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Antes de agendar, cadastre ao menos um cliente, profissional ativo e serviço ativo.</p>}
          <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-sm font-medium text-slate-700">Cliente *<select required className={fieldClass} value={form.clientId} onChange={(event) => setForm({ ...form, clientId: event.target.value })}><option value="">Selecione</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
            <label className="text-sm font-medium text-slate-700">Profissional *<select required className={fieldClass} value={form.professionalId} onChange={(event) => setForm({ ...form, professionalId: event.target.value, time: "" })}><option value="">Selecione</option>{activeProfessionals.map((professional) => <option key={professional.id} value={professional.id}>{professional.name}</option>)}</select></label>
            <label className="text-sm font-medium text-slate-700">Serviço *<select required className={fieldClass} value={form.serviceId} onChange={(event) => setForm({ ...form, serviceId: event.target.value, time: "" })}><option value="">Selecione</option>{activeServices.map((service) => <option key={service.id} value={service.id}>{service.name} · {service.duration_minutes} min · {formatCurrency(service.price)}</option>)}</select></label>
            <label className="text-sm font-medium text-slate-700">Data *<input required type="date" min={today} max={dateKeyAfter(today, 120)} className={fieldClass} value={selectedDate} onChange={(event) => { setSelectedDate(event.target.value); setForm({ ...form, time: "" }); }} /></label>
            <label className="text-sm font-medium text-slate-700">Horário disponível *<select required className={fieldClass} value={form.time} onChange={(event) => setForm({ ...form, time: event.target.value })}><option value="">{!hoursForDay ? "Sem expediente cadastrado" : hoursForDay.is_day_off ? "Dia de folga" : slots.length ? "Selecione" : "Sem horários disponíveis"}</option>{slots.map((slot) => <option key={slot} value={slot}>{slot}</option>)}</select>{form.professionalId && !hasSchedule && <button type="button" onClick={() => openHoursEditor(form.professionalId)} className="mt-2 text-xs font-semibold text-indigo-600 hover:text-indigo-700">Definir horários deste profissional</button>}</label>
            <label className="text-sm font-medium text-slate-700 lg:col-span-1">Observações<textarea rows={1} maxLength={1000} className={fieldClass} placeholder="Observação opcional" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
            <div className="flex justify-end gap-3 pt-2 sm:col-span-2 lg:col-span-3"><button type="button" onClick={closeAppointmentForm} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancelar</button><button type="submit" disabled={saving || !clients.length || !activeProfessionals.length || !activeServices.length} className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-60">{saving ? "Salvando..." : editingId ? "Salvar alterações" : "Criar agendamento"}</button></div>
          </form>
        </section>}

        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-bold text-slate-900">Atendimentos do dia</h2><p className="mt-1 text-xs text-slate-400">{dateAppointments.length} agendamentos</p></div><label className="text-sm font-medium text-slate-600">Data<input type="date" min={dateKeyAfter(today, -14)} max={dateKeyAfter(today, 120)} className="ml-3 rounded-lg border border-slate-200 px-3 py-2 text-sm" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} /></label></div>
          {dateAppointments.length === 0 ? <div className="px-6 py-14 text-center"><h3 className="font-semibold text-slate-800">Nenhum agendamento nesta data</h3><p className="mt-1 text-sm text-slate-500">Selecione outra data ou crie um novo agendamento.</p></div> : <div className="divide-y divide-slate-100">{dateAppointments.map((appointment) => <article key={appointment.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-start gap-4"><span className="shrink-0 pt-0.5 text-sm font-bold text-slate-800">{formatTime(appointment.start_at, timezone)}</span><div className="min-w-0"><h3 className="truncate font-semibold text-slate-900">{clientNames.get(appointment.client_id) ?? "Cliente"}</h3><p className="mt-1 truncate text-sm text-slate-500">{serviceNames.get(appointment.service_id) ?? "Serviço"} · {professionalNames.get(appointment.professional_id) ?? "Profissional"}</p>{appointment.notes && <p className="mt-1 truncate text-xs text-slate-400">{appointment.notes}</p>}</div></div><div className="flex flex-wrap items-center gap-3">{canManage && canEditAppointment(appointment) && <button type="button" onClick={() => beginEdit(appointment)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Editar</button>}<span className="text-sm font-semibold text-slate-700">{formatCurrency(Number(appointment.price))}</span><label className="sr-only" htmlFor={`status-${appointment.id}`}>Status do agendamento</label><select id={`status-${appointment.id}`} disabled={changingId === appointment.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" value={appointment.status} onChange={(event) => void updateStatus(appointment, event.target.value as typeof statuses[number])}>{statuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></div></article>)}</div>}
        </section>
        <p className="mt-4 text-xs text-slate-400">Os horários mostrados seguem o fuso do estabelecimento. Cancelados e não comparecimentos não bloqueiam novos horários.</p>
      </div>
    </main>
  );
}

function formatCurrency(value: number) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value); }
function dateKeyAt(date: Date, timezone: string) {
  const values = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date).map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
function weekday(dateKey: string) { return new Date(`${dateKey}T12:00:00.000Z`).getUTCDay(); }
function dateKeyAfter(dateKey: string, days: number) { const [year, month, day] = dateKey.split("-").map(Number); return new Date(Date.UTC(year, month - 1, day + days, 12)).toISOString().slice(0, 10); }
function clockMinutes(value: string) { const [hour, minute] = value.split(":").map(Number); return hour * 60 + minute; }
function minutesToClock(minutes: number) { return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`; }
function formatTime(value: string, timezone: string) { return new Intl.DateTimeFormat("pt-BR", { timeZone: timezone, hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
function zonedDateTimeToIso(dateKey: string, time: string, timezone: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const targetUtc = Date.UTC(year, month - 1, day, hour, minute);
  const formatter = new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  let timestamp = targetUtc;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(timestamp)).map((part) => [part.type, part.value]));
    const representedAsUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
    timestamp = targetUtc - (representedAsUtc - timestamp);
  }
  return new Date(timestamp).toISOString();
}

