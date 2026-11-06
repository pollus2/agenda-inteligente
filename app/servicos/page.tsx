import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import ServicesClient from "./services-client";
import type { Service } from "./types";

export default function ServicesPage() {
  return (
    <Suspense fallback={<ServicesMessage message="Carregando serviços..." />}>
      <ServicesContent />
    </Suspense>
  );
}

async function ServicesContent() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (!user && !authError) redirect("/login");
  if (authError || !user) {
    return <ServicesMessage message="Não foi possível validar sua sessão. Atualize a página para tentar novamente." />;
  }

  const { data: membership, error: membershipError } = await supabase
    .from("establishment_members")
    .select("establishment_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    return <ServicesMessage message="Não foi possível localizar seu estabelecimento. Atualize a página para tentar novamente." />;
  }
  if (!membership) redirect("/aguardando-vinculo");

  const { data, error } = await supabase
    .from("services")
    .select("id, name, description, category, duration_minutes, buffer_minutes, price, active")
    .eq("establishment_id", membership.establishment_id)
    .order("name", { ascending: true });

  if (error) {
    return <ServicesMessage message="Não foi possível carregar os serviços. Atualize a página para tentar novamente." />;
  }

  return (
    <ServicesClient
      establishmentId={membership.establishment_id}
      canManage={membership.role === "owner" || membership.role === "manager"}
      services={(data ?? []) as Service[]}
    />
  );
}

function ServicesMessage({ message }: { message: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f8fc] p-6">
      <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 text-sm text-slate-600 shadow-sm">
        {message}
      </div>
    </main>
  );
}
