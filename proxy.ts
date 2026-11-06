
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          supabaseResponse = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const caminho = request.nextUrl.pathname;

  const paginasPublicas = [
    "/login",
    "/cadastro",
    "/esqueci-senha",
    "/auth/callback",
    "/auth/confirm",
    "/agendar",
  ];

  const paginaPublica = paginasPublicas.some(
    (pagina) =>
      caminho === pagina || caminho.startsWith(`${pagina}/`)
  );

  function redirecionarComCookies(destino: string) {
    const url = request.nextUrl.clone();
    url.pathname = destino;
    url.search = "";

    const response = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      response.cookies.set(cookie);
    });
    return response;
  }

  // Impede usuários sem login de acessar o dashboard.
  if (!user && !paginaPublica) {
    return redirecionarComCookies("/login");
  }

  // Usuários logados não precisam voltar ao login. A página de cadastro
  // continua acessível para quem ainda precisa concluir o onboarding.
  if (user && caminho === "/login") {
    return redirecionarComCookies("/");
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
