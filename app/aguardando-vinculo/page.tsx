import WaitingClient from "./waiting-client";

export default function AguardandoVinculoPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f8fc] p-6">
      <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-sm sm:p-9">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-xl text-indigo-600">✓</div>
        <h1 className="mt-5 text-xl font-bold text-slate-900">Convite aceito</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Sua conta foi confirmada. O responsável pelo estabelecimento precisa vinculá-la ao seu perfil profissional antes de você acessar a agenda.
        </p>
        <WaitingClient />
      </section>
    </main>
  );
}
