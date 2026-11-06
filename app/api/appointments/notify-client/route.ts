import { createClient } from "@/utils/supabase/server";

type NotificationRequest = {
  appointmentId?: string;
  status?: string;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return Response.json({ error: "Sessão inválida." }, { status: 401 });

  let input: NotificationRequest;
  try {
    input = await request.json() as NotificationRequest;
  } catch {
    return Response.json({ error: "Solicitação inválida." }, { status: 400 });
  }

  if (!input.appointmentId || !["confirmed", "cancelled"].includes(input.status ?? "")) {
    return Response.json({ error: "Agendamento ou status inválido." }, { status: 400 });
  }

  const { data: appointment, error: appointmentError } = await supabase
    .from("appointments")
    .select("id, establishment_id, client_id, professional_id, service_id, start_at, status")
    .eq("id", input.appointmentId)
    .eq("status", input.status)
    .maybeSingle();
  if (appointmentError || !appointment) {
    return Response.json({ error: "Agendamento não encontrado ou status desatualizado." }, { status: 404 });
  }

  const { data: membership, error: membershipError } = await supabase
    .from("establishment_members")
    .select("role")
    .eq("establishment_id", appointment.establishment_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (membershipError || !membership || !["owner", "manager"].includes(membership.role)) {
    return Response.json({ error: "Apenas proprietários e gerentes podem enviar avisos." }, { status: 403 });
  }

  const { data: client } = await supabase
    .from("clients")
    .select("name, email")
    .eq("id", appointment.client_id)
    .eq("establishment_id", appointment.establishment_id)
    .maybeSingle();
  if (!client?.email) {
    return Response.json({ sent: false, reason: "missing_email" });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    return Response.json({ sent: false, reason: "not_configured" });
  }

  const [establishmentResult, serviceResult, professionalResult] = await Promise.all([
    supabase.from("establishments").select("name, timezone").eq("id", appointment.establishment_id).maybeSingle(),
    supabase.from("services").select("name").eq("id", appointment.service_id).eq("establishment_id", appointment.establishment_id).maybeSingle(),
    supabase.from("professionals").select("name").eq("id", appointment.professional_id).eq("establishment_id", appointment.establishment_id).maybeSingle(),
  ]);
  const establishmentName = establishmentResult.data?.name ?? "Estabelecimento";
  const timezone = establishmentResult.data?.timezone || "America/Sao_Paulo";
  const dateLabel = new Intl.DateTimeFormat("pt-BR", {
    timeZone: timezone,
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date(appointment.start_at));
  const statusIsConfirmed = input.status === "confirmed";
  const safeSubjectName = establishmentName.replace(/[\r\n]/g, " ");
  const subject = statusIsConfirmed ? `Agendamento confirmado · ${safeSubjectName}` : `Atualização do seu agendamento · ${safeSubjectName}`;
  const message = statusIsConfirmed
    ? `Seu agendamento de ${serviceResult.data?.name ?? "serviço"}${professionalResult.data?.name ? ` com ${professionalResult.data.name}` : ""} foi confirmado para ${dateLabel}.`
    : `Seu agendamento de ${serviceResult.data?.name ?? "serviço"}${professionalResult.data?.name ? ` com ${professionalResult.data.name}` : ""}, previsto para ${dateLabel}, foi cancelado. Entre em contato com o estabelecimento se precisar de ajuda.`;
  const safeName = escapeHtml(client.name);
  const safeEstablishment = escapeHtml(establishmentName);
  const safeMessage = escapeHtml(message);

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `appointment-${appointment.id}-${input.status}`,
      },
      body: JSON.stringify({
        from,
        to: [client.email],
        subject,
        text: `Olá, ${client.name}! ${message}\n\n${establishmentName}`,
        html: `<div style="font-family:Arial,sans-serif;color:#1e293b;line-height:1.6"><h2>${safeEstablishment}</h2><p>Olá, ${safeName}!</p><p>${safeMessage}</p></div>`,
      }),
    });
    if (!response.ok) return Response.json({ sent: false, reason: "provider_error" }, { status: 502 });
    return Response.json({ sent: true });
  } catch {
    return Response.json({ sent: false, reason: "provider_error" }, { status: 502 });
  }
}
