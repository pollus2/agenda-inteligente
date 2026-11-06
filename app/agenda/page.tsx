import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import AgendaClient from "./agenda-client";
import type {
  Appointment,
  AppointmentClient,
  AppointmentProfessional,
  AppointmentService,
  BusinessHours,
} from "./types";

type Membership = { establishment_id: string; role: string };

export default function AgendaPage() {
  return (
    <Suspense fallback={<AgendaMessage message="Carregando agenda..." />}>
      <AgendaContent />
    </Suspense>
  );
}

async function AgendaContent() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (!user && !authError) redirect("/login");
  if (authError || !user) return <AgendaMessage message="Não foi possível validar sua sessão. Atualize a página para tentar novamente." />;

  const { data: membershipData, error: membershipError } = await supabase
    .from("establishment_members")
    .select("establishment_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (membershipError) return <AgendaMessage message="Não foi possível localizar seu estabelecimento. Atualize a página para tentar novamente." />;
  if (!membershipData) redirect("/aguardando-vinculo");
  const membership = membershipData as Membership;

  const [{ data: establishment }, appointmentsResult, clientsResult, professionalsResult, servicesResult, hoursResult] = await Promise.all([
    supabase.from("establishments").select("timezone").eq("id", membership.establishment_id).maybeSingle(),
    supabase.from("appointments")
      .select("id, start_at, end_at, client_id, professional_id, service_id, status, price, notes")
      .eq("establishment_id", membership.establishment_id)
      .gte("start_at", new Date(new Date().getTime() - 14 * 86400000).toISOString())
      .lt("start_at", new Date(new Date().getTime() + 120 * 86400000).toISOString())
      .order("start_at", { ascending: true }),
    supabase.from("clients").select("id, name, phone").eq("establishment_id", membership.establishment_id).order("name"),
    supabase.from("professionals").select("id, name, active").eq("establishment_id", membership.establishment_id).order("name"),
    supabase.from("services").select("id, name, duration_minutes, buffer_minutes, price, active").eq("establishment_id", membership.establishment_id).order("name"),
    supabase.from("business_hours").select("professional_id, weekday, start_time, end_time, is_day_off").eq("establishment_id", membership.establishment_id),
  ]);

  if (appointmentsResult.error || clientsResult.error || professionalsResult.error || servicesResult.error || hoursResult.error) {
    return <AgendaMessage message="Não foi possível carregar os dados da agenda. Atualize a página para tentar novamente." />;
  }
  const timezone = getValidTimezone((establishment as { timezone?: string | null } | null)?.timezone ?? null);
  return (
    <AgendaClient
      establishmentId={membership.establishment_id}
      role={membership.role}
      userId={user.id}
      currentTime={new Date().toISOString()}
      timezone={timezone}
      appointments={(appointmentsResult.data ?? []) as Appointment[]}
      clients={(clientsResult.data ?? []) as AppointmentClient[]}
      professionals={(professionalsResult.data ?? []) as AppointmentProfessional[]}
      services={(servicesResult.data ?? []) as AppointmentService[]}
      businessHours={(hoursResult.data ?? []) as BusinessHours[]}
    />
  );
}

function getValidTimezone(timezone: string | null) {
  if (!timezone) return "America/Sao_Paulo";
  try { new Intl.DateTimeFormat("en-US", { timeZone: timezone }); return timezone; }
  catch { return "America/Sao_Paulo"; }
}

function AgendaMessage({ message }: { message: string }) {
  return <main className="flex min-h-screen items-center justify-center bg-[#f7f8fc] p-6"><div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 text-sm text-slate-600 shadow-sm">{message}</div></main>;
}
