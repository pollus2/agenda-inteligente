"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export default function WaitingClient() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function setAccountPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError("");
    setPasswordMessage("");
    if (password.length < 8) {
      setPasswordError("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== passwordConfirmation) {
      setPasswordError("As senhas não coincidem.");
      return;
    }
    setSavingPassword(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setPasswordError("Não foi possível definir a senha. Tente novamente.");
    } else {
      setPassword("");
      setPasswordConfirmation("");
      setPasswordMessage("Senha definida. Você poderá usá-la para entrar novamente.");
    }
    setSavingPassword(false);
  }

  async function signOut() {
    setSigningOut(true);
    setError("");
    const supabase = createClient();
    const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
    if (signOutError) {
      setError("Não foi possível sair. Tente novamente.");
      setSigningOut(false);
      return;
    }
    router.replace("/login");
    router.refresh();
  }

  return (
    <>
      <form onSubmit={setAccountPassword} className="mt-6 space-y-3 rounded-xl border border-slate-200 p-4 text-left">
        <h2 className="text-sm font-semibold text-slate-800">Definir senha da conta</h2>
        <label className="block text-xs font-medium text-slate-600">Senha nova
          <input required minLength={8} type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100" />
        </label>
        <label className="block text-xs font-medium text-slate-600">Confirmar senha
          <input required minLength={8} type="password" autoComplete="new-password" value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100" />
        </label>
        {passwordError && <p role="alert" className="text-xs text-rose-700">{passwordError}</p>}
        {passwordMessage && <p role="status" className="text-xs text-emerald-700">{passwordMessage}</p>}
        <button type="submit" disabled={savingPassword} className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">{savingPassword ? "Salvando..." : "Salvar senha"}</button>
      </form>
      <button type="button" onClick={() => router.push("/")} className="mt-6 inline-flex rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700">
        Verificar acesso
      </button>
      {error && <p role="alert" className="mt-4 text-sm text-rose-700">{error}</p>}
      <button type="button" onClick={() => void signOut()} disabled={signingOut} className="mt-4 block w-full text-sm font-medium text-slate-500 hover:text-slate-800 disabled:opacity-50">
        {signingOut ? "Saindo..." : "Sair e entrar com outra conta"}
      </button>
    </>
  );
}
