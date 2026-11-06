
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import DashboardClient from "./dashboard-client";
import type {
  DashboardAppointment,
  DashboardDay,
  DashboardServicePopularity,
} from "./dashboard-types";

type AppointmentRow = {
  id: string;
  start_at: string;
  end_at: string;
  client_id: string;
  professional_id: string;
  service_id: string;
  status: string;
};

type NamedRow = { id: string; name: string };

export default function Home() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <AuthenticatedDashboard />
    </Suspense>
  );
}

async function AuthenticatedDashboard() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (!user && !authError) {
    redirect("/login");
  }

  if (authError || !user) {
    return <DashboardMessage message="Não foi possível validar sua sessão. Atualize a página para tentar novamente." />;
  }

  const { data: membership, error: membershipError } = await supabase
    .from("establishment_members")
    .select("establishment_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    return <DashboardMessage message="Não foi possível carregar os dados do seu estabelecimento. Atualize a página para tentar novamente." />;
  }

  if (!membership) {
    redirect("/aguardando-vinculo");
  }

  const { data: establishment, error: establishmentError } = await supabase
    .from("establishments")
    .select("name, timezone, slug")
    .eq("id", membership.establishment_id)
    .maybeSingle();

  if (establishmentError) {
    return <DashboardMessage message="Não foi possível carregar os dados do seu estabelecimento. Atualize a página para tentar novamente." />;
  }

  if (!establishment) {
    redirect("/aguardando-vinculo");
  }

  const timezone = getValidTimezone(establishment.timezone);
  const todayKey = getDateKey(new Date(), timezone);
  const weekday = new Date(`${todayKey}T12:00:00.000Z`).getUTCDay();
  const weekStartKey = addDays(todayKey, -((weekday + 6) % 7));
  const weekEndKey = addDays(weekStartKey, 7);
  const weekStart = zonedMidnightToIso(weekStartKey, timezone);
  const weekEnd = zonedMidnightToIso(weekEndKey, timezone);
  const todayStart = zonedMidnightToIso(todayKey, timezone);
  const tomorrowStart = zonedMidnightToIso(addDays(todayKey, 1), timezone);

  const [appointmentsResult, todayCountResult, clientsCountResult, professionalsCountResult, servicesCountResult] =
    await Promise.all([
      supabase
        .from("appointments")
        .select("id, start_at, end_at, client_id, professional_id, service_id, status", { count: "exact" })
        .eq("establishment_id", membership.establishment_id)
        .gte("start_at", weekStart)
        .lt("start_at", weekEnd)
        .order("start_at", { ascending: true }),
      supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("establishment_id", membership.establishment_id)
        .gte("start_at", todayStart)
        .lt("start_at", tomorrowStart),
      supabase
        .from("clients")
        .select("id", { count: "exact", head: true })
        .eq("establishment_id", membership.establishment_id),
      supabase
        .from("professionals")
        .select("id", { count: "exact", head: true })
        .eq("establishment_id", membership.establishment_id)
        .eq("active", true),
      supabase
        .from("services")
        .select("id", { count: "exact", head: true })
        .eq("establishment_id", membership.establishment_id)
        .eq("active", true),
    ]);

  if (
    appointmentsResult.error ||
    todayCountResult.error ||
    clientsCountResult.error ||
    professionalsCountResult.error ||
    servicesCountResult.error
  ) {
    return <DashboardMessage message="Não foi possível carregar os indicadores do dashboard. Atualize a página para tentar novamente." />;
  }

  const appointmentRows = (appointmentsResult.data ?? []) as AppointmentRow[];
  const clientIds = [...new Set(appointmentRows.map((appointment) => appointment.client_id))];
  const professionalIds = [...new Set(appointmentRows.map((appointment) => appointment.professional_id))];
  const serviceIds = [...new Set(appointmentRows.map((appointment) => appointment.service_id))];

  const [clientsResult, professionalsResult, servicesResult] = await Promise.all([
    clientIds.length
      ? supabase
          .from("clients")
          .select("id, name")
          .eq("establishment_id", membership.establishment_id)
          .in("id", clientIds)
      : Promise.resolve({ data: [], error: null }),
    professionalIds.length
      ? supabase
          .from("professionals")
          .select("id, name")
          .eq("establishment_id", membership.establishment_id)
          .in("id", professionalIds)
      : Promise.resolve({ data: [], error: null }),
    serviceIds.length
      ? supabase
          .from("services")
          .select("id, name")
          .eq("establishment_id", membership.establishment_id)
          .in("id", serviceIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (clientsResult.error || professionalsResult.error || servicesResult.error) {
    return <DashboardMessage message="Não foi possível carregar os nomes dos atendimentos. Atualize a página para tentar novamente." />;
  }

  const clientNames = new Map(
    ((clientsResult.data ?? []) as NamedRow[]).map((client) => [client.id, client.name])
  );
  const professionalNames = new Map(
    ((professionalsResult.data ?? []) as NamedRow[]).map((professional) => [professional.id, professional.name])
  );
  const serviceNames = new Map(
    ((servicesResult.data ?? []) as NamedRow[]).map((service) => [service.id, service.name])
  );
  const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
  });
  const weekAppointments: DashboardAppointment[] = appointmentRows.map((appointment) => {
    const startAt = new Date(appointment.start_at);
    const dayKey = getDateKey(startAt, timezone);

    return {
      id: appointment.id,
      dayKey,
      time: timeFormatter.format(startAt),
      clientName: clientNames.get(appointment.client_id) ?? "Cliente não encontrado",
      professionalName: professionalNames.get(appointment.professional_id) ?? "Profissional não encontrado",
      serviceName: serviceNames.get(appointment.service_id) ?? "Serviço não encontrado",
      status: appointment.status,
    };
  });
  const dayCounts = new Map<string, number>();
  const serviceCounts = new Map<string, number>();

  for (const appointment of weekAppointments) {
    dayCounts.set(appointment.dayKey, (dayCounts.get(appointment.dayKey) ?? 0) + 1);
    serviceCounts.set(appointment.serviceName, (serviceCounts.get(appointment.serviceName) ?? 0) + 1);
  }

  const weekDays: DashboardDay[] = Array.from({ length: 7 }, (_, index) => {
    const key = addDays(weekStartKey, index);
    const date = new Date(`${key}T12:00:00.000Z`);
    const weekdayLabel = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "UTC",
      weekday: "short",
    }).format(date);

    return {
      key,
      label: weekdayLabel.replace(".", "").replace(/^./, (letter) => letter.toUpperCase()),
      dateNumber: date.getUTCDate(),
      count: dayCounts.get(key) ?? 0,
      isToday: key === todayKey,
    };
  });
  const servicePopularity: DashboardServicePopularity[] = [...serviceCounts]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
  const todayLabel = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${todayKey}T12:00:00.000Z`));
  const monthLabel = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  }).format(new Date(`${todayKey}T12:00:00.000Z`));

  const metadataName = user.user_metadata?.full_name;
  const userName =
    typeof metadataName === "string" && metadataName.trim()
      ? metadataName.trim()
      : user.email?.split("@")[0] || "Usuário";
  const roleLabels: Record<string, string> = {
    owner: "Proprietário",
    manager: "Gerente",
    professional: "Profissional",
  };

  return (
    <DashboardClient
      userName={userName}
      userEmail={user.email ?? ""}
      roleLabel={roleLabels[membership.role] ?? "Membro"}
      userRole={membership.role}
      establishmentName={establishment.name}
      establishmentSlug={establishment.slug}
      todayKey={todayKey}
      todayLabel={todayLabel}
      monthLabel={monthLabel}
      weekDays={weekDays}
      appointments={weekAppointments}
      servicePopularity={servicePopularity}
      stats={{
        appointmentsToday: todayCountResult.count ?? 0,
        appointmentsWeek: appointmentsResult.count ?? weekAppointments.length,
        clients: clientsCountResult.count ?? 0,
        professionals: professionalsCountResult.count ?? 0,
        services: servicesCountResult.count ?? 0,
      }}
    />
  );
}

function getValidTimezone(timezone: string | null): string {
  if (!timezone) return "America/Sao_Paulo";

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return timezone;
  } catch {
    return "America/Sao_Paulo";
  }
}

function getDateKey(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function addDays(dateKey: string, amount: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + amount, 12))
    .toISOString()
    .slice(0, 10);
}

function zonedMidnightToIso(dateKey: string, timezone: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const targetUtc = Date.UTC(year, month - 1, day);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  let timestamp = targetUtc;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = Object.fromEntries(
      formatter.formatToParts(new Date(timestamp)).map((part) => [part.type, part.value])
    );
    const representedAsUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second)
    );
    timestamp = targetUtc - (representedAsUtc - timestamp);
  }

  return new Date(timestamp).toISOString();
}

function DashboardLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f8fc] p-6">
      <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 text-sm text-slate-500 shadow-sm">
        Carregando seu estabelecimento...
      </div>
    </main>
  );
}

function DashboardMessage({ message }: { message: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f8fc] p-6">
      <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
        {message}
      </div>
    </main>
  );
}

