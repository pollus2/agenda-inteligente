import { notFound } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/utils/supabase/server";
import PublicBookingClient, { type PublicBookingData } from "./public-booking-client";

export default async function PublicBookingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return (
    <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">Carregando agendamento...</main>}>
      <BookingPageContent params={params} />
    </Suspense>
  );
}

async function BookingPageContent({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_booking_data", {
    target_slug: slug,
  });

  if (error || !data) notFound();

  const bookingData = data as unknown as PublicBookingData;
  if (!bookingData.establishment || !bookingData.services?.length || !bookingData.professionals?.length) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <section className="max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-xl font-bold text-slate-900">Agendamento indisponível</p>
          <p className="mt-2 text-sm text-slate-600">Este estabelecimento ainda não tem profissionais e serviços ativos para agendamento online.</p>
        </section>
      </main>
    );
  }

  const todayParts = new Intl.DateTimeFormat("en-US", {
    timeZone: bookingData.establishment.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const datePart = (type: string) => todayParts.find((part) => part.type === type)?.value ?? "";
  const today = `${datePart("year")}-${datePart("month")}-${datePart("day")}`;

  return <PublicBookingClient data={bookingData} initialDate={today} />;
}
