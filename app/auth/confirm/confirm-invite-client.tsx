"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

function subscribeToHashChanges(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

function getInviteErrorCode() {
  return new URLSearchParams(window.location.hash.slice(1)).get("error_code");
}

export default function ConfirmInviteClient() {
  const router = useRouter();
  const [message, setMessage] = useState("Confirmando seu convite...");
  const [failed, setFailed] = useState(false);
  const errorCode = useSyncExternalStore(subscribeToHashChanges, getInviteErrorCode, () => null);
  const expired = errorCode === "otp_expired" || errorCode === "access_denied";

  useEffect(() => {
    let active = true;

    // Supabase returns expired invitation errors in the URL fragment. Read only
    // the error code here; never persist or log the credentials in that fragment.
    if (expired) return () => { active = false; };

    const supabase = createClient();

    void supabase.auth.getUser().then(({ data: { user }, error }) => {
      if (!active) return;
      if (user && !error) {
        const flow = new URLSearchParams(window.location.search).get("flow");
        router.replace(flow === "password-reset" ? "/redefinir-senha" : "/aguardando-vinculo");
        router.refresh();
      } else {
        setMessage(error?.message.toLowerCase().includes("expired")
          ? "Este convite expirou ou já foi utilizado. Peça ao responsável para enviar um novo convite e abra o link mais recente."
          : "Não foi possível confirmar a sessão do convite. Peça ao responsável para enviar um novo convite.");
        setFailed(true);
      }
    }).catch(() => {
      if (active) {
        setMessage("Não foi possível confirmar o convite. Peça ao responsável para enviar um novo convite.");
        setFailed(true);
      }
    });

    return () => {
      active = false;
    };
  }, [expired, router]);

  const displayedMessage = expired
    ? "Este convite expirou ou já foi utilizado. Peça ao responsável para enviar um novo convite e abra o link mais recente."
    : message;
  const showLoginLink = failed || expired;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f8fc] p-6">
      <div role="status" className="max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600 shadow-sm">
        {displayedMessage}
        {showLoginLink && (
          <Link href="/login" className="mt-5 inline-flex rounded-lg bg-indigo-600 px-4 py-2.5 font-semibold text-white hover:bg-indigo-700">
            Voltar ao login
          </Link>
        )}
      </div>
    </main>
  );
}
