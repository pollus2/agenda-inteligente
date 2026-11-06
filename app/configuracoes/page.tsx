import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import SettingsClient from "./settings-client";

export default function SettingsPage() {
  return (
    <Suspense fallback={<SettingsMessage message="Carregando configurações..." />}>
      <SettingsContent />
    </Suspense>
  );
}

async function SettingsContent() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (!user && !authError) redirect("/login");
  if (authError || !user) return <SettingsMessage message="Não foi possível validar sua sessão." />;

  const { data: membership, error: membershipError } = await supabase
    .from("establishment_members")
    .select("establishment_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (membershipError) return <SettingsMessage message="Não foi possível carregar seu acesso." />;
  if (!membership) redirect("/aguardando-vinculo");

  const { data: establishment, error: establishmentError } = await supabase
    .from("establishments")
    .select("id, name, slug, phone")
    .eq("id", membership.establishment_id)
    .maybeSingle();
  if (establishmentError || !establishment) return <SettingsMessage message="Não foi possível carregar seu estabelecimento." />;

  const metadataName = user.user_metadata?.full_name;
  const userName = typeof metadataName === "string" && metadataName.trim()
    ? metadataName.trim()
    : user.email?.split("@")[0] ?? "Usuário";
  const roleLabels: Record<string, string> = {
    owner: "Proprietário",
    manager: "Gerente",
    professional: "Profissional",
  };

  return (
    <SettingsClient
      userName={userName}
      userEmail={user.email ?? ""}
      roleLabel={roleLabels[membership.role] ?? "Membro"}
      establishmentName={establishment.name}
      establishmentId={establishment.id}
      establishmentSlug={establishment.slug ?? ""}
      establishmentPhone={establishment.phone ?? ""}
      canManageEstablishment={membership.role === "owner" || membership.role === "manager"}
    />
  );
}

function SettingsMessage({ message }: { message: string }) {
  return <main className="flex min-h-screen items-center justify-center bg-[#f7f8fc] p-6"><p role="status" className="rounded-2xl border border-slate-200 bg-white px-6 py-5 text-sm text-slate-600 shadow-sm">{message}</p></main>;
}
