import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import ProfessionalsClient from "./professionals-client";
import type { Professional } from "./types";

export default function ProfessionalsPage() {
  return (
    <Suspense fallback={<ProfessionalsLoading />}>
      <ProfessionalsContent />
    </Suspense>
  );
}

async function ProfessionalsContent() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (!user && !authError) redirect("/login");

  if (authError || !user) {
    return <ProfessionalsMessage message="Não foi possível validar sua sessão. Atualize a página para tentar novamente." />;
  }

  const { data: membership, error: membershipError } = await supabase
    .from("establishment_members")
    .select("establishment_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    return <ProfessionalsMessage message="Não foi possível localizar seu estabelecimento. Atualize a página para tentar novamente." />;
  }

  if (!membership) redirect("/aguardando-vinculo");

  const { data, error } = await supabase
    .from("professionals")
    .select("id, name, phone, email, specialty, active, user_id")
    .eq("establishment_id", membership.establishment_id)
    .order("name", { ascending: true });

  if (error) {
    return <ProfessionalsMessage message="Não foi possível carregar a equipe. Atualize a página para tentar novamente." />;
  }

  return (
    <ProfessionalsClient
      establishmentId={membership.establishment_id}
      canManage={membership.role === "owner" || membership.role === "manager"}
      professionals={(data ?? []) as Professional[]}
    />
  );
}

function ProfessionalsLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f8fc] p-6">
      <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 text-sm text-slate-500 shadow-sm">
        Carregando profissionais...
      </div>
    </main>
  );
}

function ProfessionalsMessage({ message }: { message: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f8fc] p-6">
      <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
        {message}
      </div>
    </main>
  );
}
