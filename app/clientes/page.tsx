import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import ClientsClient from "./clients-client";
import type { ClientRecord } from "./types";

export default function ClientsPage() {
  return (
    <Suspense fallback={<ClientsMessage message="Carregando clientes..." />}>
      <ClientsContent />
    </Suspense>
  );
}

async function ClientsContent() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (!user && !authError) redirect("/login");
  if (authError || !user) {
    return <ClientsMessage message="Não foi possível validar sua sessão. Atualize a página para tentar novamente." />;
  }

  const { data: membership, error: membershipError } = await supabase
    .from("establishment_members")
    .select("establishment_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    return <ClientsMessage message="Não foi possível localizar seu estabelecimento. Atualize a página para tentar novamente." />;
  }
  if (!membership) redirect("/aguardando-vinculo");

  const { data, error } = await supabase
    .from("clients")
    .select("id, name, phone, email, birth_date, notes")
    .eq("establishment_id", membership.establishment_id)
    .order("name", { ascending: true });

  if (error) {
    return <ClientsMessage message="Não foi possível carregar os clientes. Atualize a página para tentar novamente." />;
  }

  return (
    <ClientsClient
      establishmentId={membership.establishment_id}
      canManage={membership.role === "owner" || membership.role === "manager"}
      clients={(data ?? []) as ClientRecord[]}
    />
  );
}

function ClientsMessage({ message }: { message: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f8fc] p-6">
      <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 text-sm text-slate-600 shadow-sm">
        {message}
      </div>
    </main>
  );
}
