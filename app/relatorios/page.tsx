import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import ReportsExportButton from "./reports-export-button";

type AppointmentRow = {
  id: string;
  start_at: string;
  status: string;
  price: number | string;
  client_id: string;
  professional_id: string;
  service_id: string;
};

type NamedRow = { id: string; name: string };
type DailyCount = { key: string; label: string; count: number };
type ServiceCount = { name: string; count: number };

export default function ReportsPage() {
  return (
    <Suspense fallback={<ReportMessage message="Carregando relatórios..." />}>
      <ReportsContent />
    </Suspense>
  );
}

async function ReportsContent() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (!user && !authError) redirect("/login");
  if (authError || !user) return <ReportMessage message="Não foi possível validar sua sessão. Atualize a página para tentar novamente." />;

  const { data: membership, error: membershipError } = await supabase
    .from("establishment_members")
    .select("establishment_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (membershipError) return <ReportMessage message="Não foi possível localizar seu estabelecimento." />;
  if (!membership) redirect("/aguardando-vinculo");

  const { data: establishment, error: establishmentError } = await supabase
    .from("establishments")
    .select("name, timezone")
    .eq("id", membership.establishment_id)
    .maybeSingle();
  if (establishmentError || !establishment) return <ReportMessage message="Não foi possível carregar o estabelecimento." />;

  const now = new Date();
  const timezone = getValidTimezone(establishment.timezone);
  const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const appointments: AppointmentRow[] = [];
  const pageSize = 500;

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("appointments")
      .select("id, start_at, status, price, client_id, professional_id, service_id")
      .eq("establishment_id", membership.establishment_id)
      .gte("start_at", start)
      .lte("start_at", now.toISOString())
      .order("start_at", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) return <ReportMessage message="Não foi possível carregar os agendamentos do relatório." />;
    appointments.push(...((data ?? []) as AppointmentRow[]));
    if (!data || data.length < pageSize) break;
  }

  const clientIds = [...new Set(appointments.map((appointment) => appointment.client_id))];
  const professionalIds = [...new Set(appointments.map((appointment) => appointment.professional_id))];
  const serviceIds = [...new Set(appointments.map((appointment) => appointment.service_id))];
  const [clientsResult, professionalsResult, servicesResult] = await Promise.all([
    clientIds.length ? supabase.from("clients").select("id, name").eq("establishment_id", membership.establishment_id).in("id", clientIds) : Promise.resolve({ data: [] as NamedRow[], error: null }),
    professionalIds.length ? supabase.from("professionals").select("id, name").eq("establishment_id", membership.establishment_id).in("id", professionalIds) : Promise.resolve({ data: [] as NamedRow[], error: null }),
    serviceIds.length ? supabase.from("services").select("id, name").eq("establishment_id", membership.establishment_id).in("id", serviceIds) : Promise.resolve({ data: [] as NamedRow[], error: null }),
  ]);
  if (clientsResult.error || professionalsResult.error || servicesResult.error) return <ReportMessage message="Não foi possível carregar os nomes dos registros do relatório." />;

  const clientNames = new Map(((clientsResult.data ?? []) as NamedRow[]).map((row) => [row.id, row.name]));
  const professionalNames = new Map(((professionalsResult.data ?? []) as NamedRow[]).map((row) => [row.id, row.name]));
  const serviceNames = new Map(((servicesResult.data ?? []) as NamedRow[]).map((service) => [service.id, service.name]));
  const completed = appointments.filter((appointment) => appointment.status === "completed");
  const cancelled = appointments.filter((appointment) => appointment.status === "cancelled");
  const noShow = appointments.filter((appointment) => appointment.status === "no_show");
  const revenue = completed.reduce((sum, appointment) => sum + Number(appointment.price || 0), 0);

  const serviceCountsMap = new Map<string, number>();
  for (const appointment of appointments) {
    const name = serviceNames.get(appointment.service_id) ?? "Serviço removido";
    serviceCountsMap.set(name, (serviceCountsMap.get(name) ?? 0) + 1);
  }
  const popularServices: ServiceCount[] = [...serviceCountsMap]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const todayKey = dateKey(now, timezone);
  const dailyCounts: DailyCount[] = Array.from({ length: 7 }, (_, index) => {
    const key = addDays(todayKey, index - 6);
    const date = new Date(`${key}T12:00:00.000Z`);
    return {
      key,
      label: new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", weekday: "short", day: "2-digit" }).format(date).replace(".", ""),
      count: appointments.filter((appointment) => dateKey(new Date(appointment.start_at), timezone) === key).length,
    };
  });
  const maxDailyCount = Math.max(1, ...dailyCounts.map((day) => day.count));
  const periodLabel = `${new Intl.DateTimeFormat("pt-BR", { timeZone: timezone, day: "numeric", month: "short" }).format(new Date(start))} a ${new Intl.DateTimeFormat("pt-BR", { timeZone: timezone, day: "numeric", month: "short", year: "numeric" }).format(now)}`;
  const professionalView = membership.role === "professional";
  const exportRows = appointments.map((appointment) => ({
    startAt: appointment.start_at,
    client: clientNames.get(appointment.client_id) ?? "Cliente removido",
    professional: professionalNames.get(appointment.professional_id) ?? "Profissional removido",
    service: serviceNames.get(appointment.service_id) ?? "Serviço removido",
    status: appointment.status,
    price: Number(appointment.price),
  }));

  return (
    <main className="min-h-screen bg-[#f7f8fc] text-slate-800">
      <div className="mx-auto max-w-6xl px-5 py-6 sm:px-8 sm:py-9">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link href="/" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">← Voltar ao dashboard</Link>
            <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{professionalView ? "Meu desempenho" : "Relatórios"}</h1>
            <p className="mt-1 text-sm text-slate-500">{establishment.name} · últimos 30 dias ({periodLabel})</p>
          </div>
          <ReportsExportButton rows={exportRows} timezone={timezone} />
        </header>

        <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Agendamentos" value={appointments.length.toLocaleString("pt-BR")} detail="No período" />
          <MetricCard label="Atendimentos concluídos" value={completed.length.toLocaleString("pt-BR")} detail="Marcados como concluídos" />
          <MetricCard label="Faturamento concluído" value={formatCurrency(revenue)} detail="Soma dos atendimentos concluídos" />
          <MetricCard label="Cancelados / faltas" value={`${cancelled.length.toLocaleString("pt-BR")} / ${noShow.length.toLocaleString("pt-BR")}`} detail="Cancelamentos / não comparecimentos" />
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="font-bold text-slate-900">Agendamentos por dia</h2>
            <p className="mt-1 text-xs text-slate-500">Últimos sete dias</p>
            <div className="mt-7 flex h-44 items-end justify-between gap-3">
              {dailyCounts.map((day) => (
                <div key={day.key} className="flex h-full flex-1 flex-col items-center justify-end gap-2" title={`${day.count} agendamentos`}>
                  <span className="text-xs font-semibold text-slate-600">{day.count || ""}</span>
                  <div className="flex w-full flex-1 items-end">
                    <div className={`w-full rounded-t-lg ${day.key === todayKey ? "bg-indigo-600" : "bg-indigo-100"}`} style={{ height: `${day.count ? Math.max(8, (day.count / maxDailyCount) * 100) : 0}%` }} />
                  </div>
                  <span className="text-center text-[10px] capitalize text-slate-400">{day.label}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="font-bold text-slate-900">Serviços mais agendados</h2>
            <p className="mt-1 text-xs text-slate-500">No período de 30 dias</p>
            <div className="mt-6 space-y-5">
              {popularServices.map((service) => (
                <div key={service.name}>
                  <div className="mb-2 flex justify-between gap-3 text-sm">
                    <span className="truncate font-medium text-slate-700">{service.name}</span>
                    <span className="shrink-0 text-slate-400">{service.count}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-indigo-500" style={{ width: `${(service.count / (popularServices[0]?.count ?? 1)) * 100}%` }} />
                  </div>
                </div>
              ))}
              {popularServices.length === 0 && <p className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">Os serviços mais agendados aparecerão aqui quando houver registros no período.</p>}
            </div>
          </section>
        </div>

        {appointments.length === 0 && (
          <p className="mt-6 rounded-xl border border-slate-200 bg-white p-4 text-center text-sm text-slate-500">Ainda não há dados para este relatório.</p>
        )}
      </div>
    </main>
  );
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-3 break-words text-2xl font-bold tracking-tight text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{detail}</p>
    </article>
  );
}

function ReportMessage({ message }: { message: string }) {
  return <main className="flex min-h-screen items-center justify-center bg-[#f7f8fc] p-6"><p role="status" className="max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">{message}</p></main>;
}

function dateKey(date: Date, timezone: string) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function addDays(dateKeyValue: string, amount: number) {
  const [year, month, day] = dateKeyValue.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + amount, 12)).toISOString().slice(0, 10);
}

function getValidTimezone(timezone: string | null) {
  if (!timezone) return "America/Sao_Paulo";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return timezone;
  } catch {
    return "America/Sao_Paulo";
  }
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}
