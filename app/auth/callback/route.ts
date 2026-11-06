
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const nextPath = requestUrl.searchParams.get("next");

  if (!code) {
    return NextResponse.redirect(
      new URL("/login?erro=confirmacao", requestUrl.origin)
    );
  }

  const supabase = await createClient();

  const { error: authError } =
    await supabase.auth.exchangeCodeForSession(code);

  if (authError) {
    console.error("Erro na confirmação:", authError.message);

    return NextResponse.redirect(
      new URL("/login?erro=confirmacao", requestUrl.origin)
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(
      new URL("/login?erro=usuario", requestUrl.origin)
    );
  }

  // Password recovery is already authorized by the one-time PKCE code.
  // Allow only this fixed local destination to avoid an open redirect.
  if (nextPath === "/redefinir-senha") {
    return NextResponse.redirect(new URL(nextPath, requestUrl.origin));
  }

  const { data: membership, error: membershipError } = await supabase
    .from("establishment_members")
    .select("establishment_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    console.error("Erro ao consultar vínculo do usuário:", membershipError.message);
    return NextResponse.redirect(
      new URL("/login?erro=vinculo", requestUrl.origin)
    );
  }

  if (membership) {
    return NextResponse.redirect(new URL("/", requestUrl.origin));
  }

  const { data: estabelecimentoExistente, error: buscaError } =
    await supabase
      .from("establishments")
      .select("id")
      .eq("created_by", user.id)
      .maybeSingle();

  if (buscaError) {
    console.error("Erro ao consultar estabelecimento:", buscaError.message);

    return NextResponse.redirect(
      new URL("/login?erro=estabelecimento", requestUrl.origin)
    );
  }

  if (estabelecimentoExistente) {
    return NextResponse.redirect(new URL("/", requestUrl.origin));
  }

  const metadata = user.user_metadata;

  const nome = metadata.establishment_name;
  const telefone = metadata.phone;
  const tipoNegocio = metadata.business_type;

  if (
    typeof nome !== "string" ||
    !nome.trim() ||
    typeof telefone !== "string" ||
    typeof tipoNegocio !== "string"
  ) {
    return NextResponse.redirect(
      new URL("/aguardando-vinculo", requestUrl.origin)
    );
  }

  const slugBase = nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 45);

  const slug = `${slugBase || "estabelecimento"}-${crypto.randomUUID().slice(0, 8)}`;

  const { error: insertError } = await supabase
    .from("establishments")
    .insert({
      name: nome.trim(),
      slug,
      business_type: tipoNegocio,
      phone: telefone,
      email: user.email,
    });

  if (insertError) {
    console.error("Erro ao criar estabelecimento:", insertError.message);

    return NextResponse.redirect(
      new URL("/cadastro?erro=criacao", requestUrl.origin)
    );
  }

  return NextResponse.redirect(new URL("/", requestUrl.origin));
}
