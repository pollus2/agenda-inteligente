"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import type {
  DashboardAppointment,
  DashboardDay,
  DashboardServicePopularity,
  DashboardStats,
} from "./dashboard-types";

const navigation = [
  { name: "Dashboard", icon: "grid" },
  { name: "Agenda", icon: "calendar" },
  { name: "Agendamentos", icon: "clock" },
  { name: "Clientes", icon: "users" },
  { name: "Profissionais", icon: "briefcase" },
  { name: "Serviços", icon: "scissors" },
  { name: "Relatórios", icon: "chart" },
];

function formatStatus(status: string) {
  const normalized = status.trim().toLowerCase().replace(/[_-]+/g, " ");
  const translations: Record<string, string> = {
    pending: "Pendente",
    confirmed: "Confirmado",
    scheduled: "Agendado",
    completed: "Concluído",
    canceled: "Cancelado",
    cancelled: "Cancelado",
    no_show: "Não compareceu",
  };

  if (translations[status.trim().toLowerCase()]) {
    return translations[status.trim().toLowerCase()];
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function statusColor(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes("cancel")) return "bg-rose-100 text-rose-700";
  if (normalized.includes("pend")) return "bg-amber-100 text-amber-700";
  if (normalized.includes("complet") || normalized.includes("conclu")) {
    return "bg-emerald-100 text-emerald-700";
  }
  return "bg-indigo-100 text-indigo-700";
}

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  const paths: Record<string, React.ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    briefcase: <><rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V4h8v3M3 12h18M10 12v2h4v-2"/></>,
    scissors: <><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="m8.1 8.1 12 12M14 10l6-6M8.1 15.9l3-3"/></>,
    chart: <><path d="M3 3v18h18"/><path d="m7 14 4-4 4 4 6-7"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    arrow: <><path d="m9 18 6-6-6-6"/></>,
    left: <><path d="m15 18-6-6 6-6"/></>,
    right: <><path d="m9 18 6-6-6-6"/></>,
    more: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    money: <><rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 9h.01M18 15h.01"/></>,
    trend: <><path d="m3 17 6-6 4 4 8-9"/><path d="M15 6h6v6"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.7a8 8 0 0 1-1.5.9l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.5-.9l-1.7.7-1.4-2.4 1.4-1.1a8 8 0 0 1 0-1.8L6.3 12l1.4-2.4 1.7.7a8 8 0 0 1 1.5-.9l.3-1.8H14l.3 1.8a8 8 0 0 1 1.5.9l1.7-.7 1.4 2.4-1.4 1.1a8 8 0 0 1-.1 1.9z"/></>,
    logout: <><path d="M10 17l5-5-5-5M15 12H3"/><path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7"/></>,
    menu: <><path d="M4 6h16M4 12h16M4 18h16"/></>,
    close: <><path d="m6 6 12 12M18 6 6 18"/></>,
  };

  return <svg {...common}>{paths[name] || paths.grid}</svg>;
}

function StatCard({ title, value, subtitle, icon, color }: {
  title: string;
  value: string;
  subtitle: string;
  icon: string;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-500">{title}</span>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${color}`}>
          <Icon name={icon} />
        </div>
      </div>
      <div className="mt-4 flex items-end justify-between">
        <span className="text-2xl font-bold tracking-tight text-slate-900">{value}</span>
        <span className="text-right text-xs font-medium text-slate-400">{subtitle}</span>
      </div>
    </div>
  );
}

type DashboardClientProps = {
  userName: string;
  userEmail: string;
  roleLabel: string;
  userRole: string;
  establishmentName: string;
  establishmentSlug: string;
  todayKey: string;
  todayLabel: string;
  monthLabel: string;
  weekDays: DashboardDay[];
  appointments: DashboardAppointment[];
  servicePopularity: DashboardServicePopularity[];
  stats: DashboardStats;
};

export default function DashboardClient({
  userName,
  userEmail,
  roleLabel,
  userRole,
  establishmentName,
  establishmentSlug,
  todayKey,
  todayLabel,
  monthLabel,
  weekDays,
  appointments,
  servicePopularity,
  stats,
}: DashboardClientProps) {
  const router = useRouter();
  const canManage = userRole === "owner" || userRole === "manager";
  const [active, setActive] = useState("Dashboard");
  const [view, setView] = useState("Semana");
  const [selectedDay, setSelectedDay] = useState(todayKey);
  const [showNotification, setShowNotification] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const [bookingLinkCopied, setBookingLinkCopied] = useState(false);

  async function copyBookingLink() {
    const url = `${window.location.origin}/agendar/${encodeURIComponent(establishmentSlug)}`;
    try {
      await navigator.clipboard.writeText(url);
      setBookingLinkCopied(true);
      window.setTimeout(() => setBookingLinkCopied(false), 2500);
    } catch {
      window.prompt("Copie o link de agendamento:", url);
    }
  }

  const initials = userName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  const selectedDayAppointments = appointments.filter((appointment) => appointment.dayKey === selectedDay);
  const visibleAppointments = view === "Dia" ? selectedDayAppointments : appointments;
  const pendingAppointments = appointments.filter((appointment) => appointment.status === "pending");
  const normalizedSearch = searchQuery.trim().toLocaleLowerCase("pt-BR");
  const searchResults = normalizedSearch
    ? appointments.filter((appointment) => [
        appointment.clientName,
        appointment.professionalName,
        appointment.serviceName,
        formatStatus(appointment.status),
      ].some((value) => value.toLocaleLowerCase("pt-BR").includes(normalizedSearch))).slice(0, 6)
    : [];
  const selectedDateLabel = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
  }).format(new Date(`${selectedDay}T12:00:00.000Z`));
  const maxAppointmentsPerDay = Math.max(...weekDays.map((day) => day.count), 0);
  const maxServiceCount = Math.max(...servicePopularity.map((service) => service.count), 0);
  const serviceColors = ["bg-indigo-500", "bg-violet-500", "bg-pink-400"];

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setShowSearch(true);
      }
      if (event.key === "Escape") setShowSearch(false);
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  function navigateTo(itemName: string) {
    setShowMobileMenu(false);
    if (itemName === "Dashboard") {
      setActive("Dashboard");
      router.push("/");
    } else if (itemName === "Agenda" || itemName === "Agendamentos") {
      router.push("/agenda");
    } else if (itemName === "Clientes") {
      router.push("/clientes");
    } else if (itemName === "Profissionais") {
      router.push("/profissionais");
    } else if (itemName === "Serviços") {
      router.push("/servicos");
    } else if (itemName === "Relatórios") {
      router.push("/relatorios");
    } else if (itemName === "Configurações") {
      router.push("/configuracoes");
    }
  }

  async function handleLogout() {
    setIsLoggingOut(true);
    setLogoutError("");

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) throw error;

      router.replace("/login");
      router.refresh();
    } catch {
      setLogoutError("Não foi possível sair. Tente novamente.");
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-[#f7f8fc] text-slate-800">

      {/* SIDEBAR */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white px-5 py-6 lg:flex">
        <div className="mb-10 flex items-center gap-3 px-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200">
            <Icon name="calendar" size={23} />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900">Agenda<span className="text-indigo-600">+</span></h1>
            <p className="text-[11px] font-medium tracking-wide text-slate-400">INTELIGÊNCIA NA GESTÃO</p>
          </div>
        </div>

        <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Menu principal</p>

        <nav className="flex flex-1 flex-col gap-1">
          {navigation.map((item) => (
            <button
              key={item.name}
              onClick={() => navigateTo(item.name)}
              className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${
                active === item.name
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Icon name={item.icon} size={19} />
              {item.name}
              {item.name === "Agendamentos" && stats.appointmentsWeek > 0 && (
                <span className="ml-auto rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700">{stats.appointmentsWeek}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 p-4 text-white">
          <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-white/20">
            <Icon name="trend" />
          </div>
          <p className="text-sm font-bold">Sua agenda, mais inteligente.</p>
          <p className="mt-1 text-xs leading-relaxed text-indigo-100">Automatize sua rotina e aproveite melhor seu tempo.</p>
          <Link href="/relatorios" className="mt-4 block w-full rounded-lg bg-white px-3 py-2 text-center text-xs font-bold text-indigo-700 hover:bg-indigo-50">
            Ver relatórios
          </Link>
        </div>

        <button
          onClick={() => navigateTo("Configurações")}
          className="mt-5 flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-500 hover:bg-slate-50"
        >
          <Icon name="settings" size={19} /> Configurações
        </button>
        <div className="mt-3 flex items-center gap-3 border-t border-slate-100 pt-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">{initials}</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-800">{userName}</p>
            <p className="truncate text-xs text-slate-400" title={userEmail}>{userEmail}</p>
            <p className="text-[10px] text-slate-400">{roleLabel}</p>
          </div>
        </div>
        <div className="mt-4 border-t border-slate-100 pt-3">
          {logoutError && <p role="alert" className="mb-2 px-3 text-xs text-rose-600">{logoutError}</p>}
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-500 transition hover:bg-rose-50 hover:text-rose-700 disabled:cursor-wait disabled:opacity-60"
          >
            <Icon name="logout" size={19} />
            {isLoggingOut ? "Saindo..." : "Sair"}
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <main className="min-w-0 flex-1">
        <header className="sticky top-0 z-10 flex h-[76px] items-center justify-between border-b border-slate-200 bg-white/90 px-5 backdrop-blur-md sm:px-8">
          <div>
            <p className="max-w-[60vw] truncate text-xs text-slate-400">{establishmentName} / Visão geral</p>
            <h2 className="text-lg font-bold text-slate-900">{active}</h2>
          </div>

          <div className="flex items-center gap-3">
            {canManage && establishmentSlug && (
              <button type="button" onClick={copyBookingLink} className="hidden rounded-xl bg-indigo-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 sm:block">
                {bookingLinkCopied ? "Link copiado" : "Compartilhar agendamento"}
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowMobileMenu((open) => !open)}
              aria-label={showMobileMenu ? "Fechar menu" : "Abrir menu"}
              aria-expanded={showMobileMenu}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 lg:hidden"
            >
              <Icon name={showMobileMenu ? "close" : "menu"} size={19} />
            </button>
            <button type="button" onClick={() => setShowSearch(true)} className="hidden h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm text-slate-500 sm:flex">
              <Icon name="search" size={17} /> Buscar
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px]">Ctrl K</span>
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowNotification(!showNotification)}
                aria-label={`${pendingAppointments.length} agendamentos pendentes`}
                className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50"
              >
                <Icon name="bell" size={19} />
                {pendingAppointments.length > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">{pendingAppointments.length > 9 ? "9+" : pendingAppointments.length}</span>}
              </button>
              {showNotification && (
                <div className="absolute right-0 top-12 w-64 rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
                  <p className="font-semibold text-slate-800">Pendências da semana</p>
                  {pendingAppointments.length ? (
                    <div className="mt-2 space-y-2">
                      {pendingAppointments.slice(0, 4).map((appointment) => (
                        <button key={appointment.id} type="button" onClick={() => { setSelectedDay(appointment.dayKey); setView("Dia"); setShowNotification(false); }} className="block w-full truncate rounded-lg p-2 text-left text-sm text-slate-600 hover:bg-slate-50">
                          {appointment.time} · {appointment.clientName}
                        </button>
                      ))}
                      {pendingAppointments.length > 4 && <p className="px-2 text-xs text-slate-400">+{pendingAppointments.length - 4} pendências</p>}
                    </div>
                  ) : <p className="mt-2 text-sm text-slate-500">Nenhum agendamento pendente nesta semana.</p>}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              aria-label="Sair da conta"
              title="Sair"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-rose-50 hover:text-rose-700 disabled:cursor-wait disabled:opacity-60 lg:hidden"
            >
              <Icon name="logout" size={18} />
            </button>
            <div className="hidden h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700 sm:flex">{initials}</div>
          </div>
        </header>

        {showMobileMenu && (
          <div className="fixed inset-x-0 top-[76px] z-30 max-h-[calc(100vh-76px)] overflow-y-auto border-b border-slate-200 bg-white p-4 shadow-xl lg:hidden">
            <button type="button" onClick={() => { setShowSearch(true); setShowMobileMenu(false); }} className="mb-4 flex w-full items-center gap-3 rounded-xl border border-slate-200 px-3 py-3 text-left text-sm font-medium text-slate-600">
              <Icon name="search" size={18} /> Buscar agendamentos da semana
            </button>
            <nav aria-label="Navegação móvel" className="grid gap-1 sm:grid-cols-2">
              {navigation.map((item) => (
                <button key={item.name} type="button" onClick={() => navigateTo(item.name)} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium ${active === item.name ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50"}`}>
                  <Icon name={item.icon} size={18} /> {item.name}
                </button>
              ))}
              <button type="button" onClick={() => navigateTo("Configurações")} className="flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-slate-600 hover:bg-slate-50">
                <Icon name="settings" size={18} /> Configurações
              </button>
            </nav>
            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className="px-3 text-xs text-slate-400">{userName} · {roleLabel}</p>
              <button type="button" onClick={() => void handleLogout()} disabled={isLoggingOut} className="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50">
                <Icon name="logout" size={18} /> {isLoggingOut ? "Saindo..." : "Sair"}
              </button>
            </div>
          </div>
        )}

        {logoutError && (
          <p role="alert" className="mx-5 mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 lg:hidden">
            {logoutError}
          </p>
        )}

        <div className="mx-auto max-w-[1500px] p-5 sm:p-8">

          {/* WELCOME */}
          <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm capitalize text-slate-500">{todayLabel}</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Olá, {userName.split(/\s+/)[0]}! <span>☀️</span>
              </h1>
              <p className="mt-1 text-sm text-slate-500">Aqui está o resumo do seu estabelecimento hoje.</p>
            </div>
            {canManage && <button
              onClick={() => router.push("/agenda")}
              className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700"
            >
              <Icon name="plus" size={18} /> Novo agendamento
            </button>}
          </div>

          {/* STATS */}
          <div className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Agendamentos hoje" value={stats.appointmentsToday.toLocaleString("pt-BR")} subtitle={`${stats.appointmentsWeek} nesta semana`} icon="calendar" color="bg-indigo-50 text-indigo-600" />
            <StatCard title={userRole === "professional" ? "Meus clientes vinculados" : "Clientes cadastrados"} value={stats.clients.toLocaleString("pt-BR")} subtitle={userRole === "professional" ? "Dos meus agendamentos" : "No estabelecimento"} icon="users" color="bg-emerald-50 text-emerald-600" />
            <StatCard title={userRole === "professional" ? "Meu perfil" : "Profissionais ativos"} value={stats.professionals.toLocaleString("pt-BR")} subtitle={userRole === "professional" ? "Perfil vinculado" : "Na equipe"} icon="briefcase" color="bg-violet-50 text-violet-600" />
            <StatCard title={userRole === "professional" ? "Serviços dos meus atendimentos" : "Serviços ativos"} value={stats.services.toLocaleString("pt-BR")} subtitle={userRole === "professional" ? "Associados à agenda" : "Disponíveis"} icon="scissors" color="bg-amber-50 text-amber-600" />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.55fr_1fr]">

            {/* CALENDAR */}
            <section id="dashboard-calendar" className="scroll-mt-24 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Agenda de atendimentos</h3>
                  <p className="mt-1 text-xs text-slate-400">Acompanhe seus horários e compromissos.</p>
                </div>
                <div className="flex rounded-lg bg-slate-100 p-1">
                  {["Dia", "Semana"].map((item) => (
                    <button
                      key={item}
                      onClick={() => setView(item)}
                      className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                        view === item ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500"
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold capitalize text-slate-800">{monthLabel}</h4>
                  <span className="rounded-md bg-indigo-50 px-2 py-1 text-[10px] font-semibold text-indigo-600">Esta semana</span>
                </div>
                <span className="text-xs text-slate-400">{view === "Dia" ? selectedDateLabel : `${weekDays[0]?.dateNumber} a ${weekDays[6]?.dateNumber}`}</span>
              </div>

              <div className="mb-5 grid grid-cols-7 gap-2">
                {weekDays.map((item) => (
                  <button
                    key={item.key}
                    onClick={() => setSelectedDay(item.key)}
                    aria-pressed={selectedDay === item.key}
                    aria-label={`${item.label}, ${item.dateNumber}${item.count ? `, ${item.count} agendamentos` : ", sem agendamentos"}`}
                    className={`flex flex-col items-center gap-2 rounded-xl py-3 transition ${
                      selectedDay === item.key ? "bg-indigo-600 text-white shadow-md shadow-indigo-200" : "text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    <span className="text-[11px] font-medium">{item.label}</span>
                    <span className="text-sm font-bold">{item.dateNumber}</span>
                    <span className={`h-1 w-1 rounded-full ${selectedDay === item.key ? "bg-white" : item.count ? "bg-indigo-400" : "bg-transparent"}`}/>
                  </button>
                ))}
              </div>

              <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="text-sm font-semibold capitalize text-slate-700">{view === "Dia" ? `Horários — ${selectedDateLabel}` : "Agendamentos da semana"}</span>
                <span className="text-xs text-slate-400">{visibleAppointments.length} atendimentos</span>
              </div>

              <div className="space-y-3">
                {visibleAppointments.map((item) => {
                  const itemColor = statusColor(item.status);

                  return (
                  <div key={item.id} className="flex gap-3 rounded-xl border border-slate-100 p-3 transition hover:border-indigo-100 hover:bg-slate-50/70">
                    <div className="w-14 shrink-0 pt-1">
                      <p className="text-sm font-bold text-slate-800">{item.time}</p>
                      {view === "Semana" && <p className="mt-1 text-[10px] capitalize text-slate-400">{new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", weekday: "short", day: "2-digit" }).format(new Date(`${item.dayKey}T12:00:00.000Z`)).replace(".", "")}</p>}
                    </div>
                    <div className={`w-1 shrink-0 rounded-full ${itemColor.split(" ")[0].replace("100", "500")}`}/>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-slate-800">{item.clientName}</p>
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${itemColor}`}>{formatStatus(item.status)}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{item.serviceName} · {item.professionalName}</p>
                    </div>
                    <button type="button" onClick={() => router.push("/agenda")} aria-label="Abrir agenda completa" title="Abrir agenda completa" className="self-center rounded-lg p-2 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600"><Icon name="arrow" size={16}/></button>
                  </div>
                  );
                })}
                {visibleAppointments.length === 0 && (
                  <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center">
                    <p className="text-sm font-medium text-slate-600">{view === "Dia" ? "Nenhum agendamento neste dia" : "Nenhum agendamento nesta semana"}</p>
                    <p className="mt-1 text-xs text-slate-400">Os novos agendamentos aparecerão aqui.</p>
                  </div>
                )}
              </div>

              <button
                onClick={() => router.push("/agenda")}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 py-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Ver agenda completa <Icon name="arrow" size={15}/>
              </button>
            </section>

            {/* RIGHT COLUMN */}
            <div className="flex flex-col gap-6">

              {/* PERFORMANCE */}
              <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900">Desempenho semanal</h3>
                    <p className="mt-1 text-xs text-slate-400">Agendamentos por dia</p>
                  </div>
                </div>

                <div className="mt-6 flex h-36 items-end justify-between gap-3">
                  {weekDays.map((day) => {
                    const height = maxAppointmentsPerDay
                      ? (day.count / maxAppointmentsPerDay) * 100
                      : 0;

                    return (
                    <div key={day.key} className="flex h-full flex-1 flex-col items-center justify-end gap-2" title={`${day.count} agendamentos`}>
                      <div className="flex w-full flex-1 items-end">
                        <div
                          style={{ height: `${height}%` }}
                          className={`w-full rounded-t-lg transition ${day.isToday ? "bg-indigo-600" : "bg-indigo-100 hover:bg-indigo-200"}`}
                        />
                      </div>
                      <span className="text-[10px] font-medium text-slate-400">{day.label}</span>
                    </div>
                    );
                  })}
                </div>
                {stats.appointmentsWeek === 0 && (
                  <p className="mt-4 text-center text-xs text-slate-400">Ainda não há agendamentos nesta semana.</p>
                )}
              </section>

              {/* SERVICES */}
              <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900">Serviços populares</h3>
                    <p className="mt-1 text-xs text-slate-400">Agendamentos desta semana</p>
                  </div>
                  <button onClick={() => router.push("/servicos")} className="text-xs font-semibold text-indigo-600">Ver todos</button>
                </div>
                {servicePopularity.map((item, index) => (
                  <div key={item.name} className="mb-4 last:mb-0">
                    <div className="mb-2 flex justify-between text-xs">
                      <span className="font-medium text-slate-700">{item.name}</span>
                      <span className="text-slate-400">{item.count} agendamentos</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className={`h-full rounded-full ${serviceColors[index % serviceColors.length]}`} style={{ width: `${maxServiceCount ? (item.count / maxServiceCount) * 100 : 0}%` }}/>
                    </div>
                  </div>
                ))}
                {servicePopularity.length === 0 && (
                  <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-xs text-slate-400">
                    Os serviços mais agendados aparecerão aqui quando houver atendimentos.
                  </p>
                )}
              </section>

              {/* SMART ASSISTANT */}
              <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 p-5 text-white shadow-lg shadow-indigo-200">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
                    <span className="text-xl">✦</span>
                  </div>
                  <div>
                    <p className="font-bold">Assistente inteligente</p>
                    <p className="text-[11px] text-indigo-100">Seu negócio em boas mãos</p>
                  </div>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-indigo-50">
                  Em breve, sua agenda poderá ajudar a organizar horários, confirmar atendimentos e reduzir cancelamentos automaticamente.
                </p>
                <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-white/90">
                  <span className="h-2 w-2 rounded-full bg-emerald-300"/> Preparado para automação
                </div>
              </section>
            </div>
          </div>

          <footer className="mt-8 flex flex-col justify-between gap-2 border-t border-slate-200 pt-5 text-xs text-slate-400 sm:flex-row">
            <p>© 2026 Agenda Inteligente. Todos os direitos reservados.</p>
            <p>Versão 0.1.0 · Ambiente de desenvolvimento</p>
          </footer>
        </div>
      </main>
      {showSearch && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/40 p-4 pt-[12vh] backdrop-blur-sm">
          <section role="dialog" aria-modal="true" aria-labelledby="dashboard-search-title" className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center gap-3 border-b border-slate-100 px-4">
              <Icon name="search" size={18} />
              <label id="dashboard-search-title" className="sr-only" htmlFor="dashboard-search-input">Buscar agendamentos desta semana</label>
              <input
                id="dashboard-search-input"
                autoFocus
                type="search"
                placeholder="Buscar cliente, profissional, serviço ou status..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="h-14 min-w-0 flex-1 text-sm outline-none"
              />
              <button type="button" onClick={() => { setShowSearch(false); setSearchQuery(""); }} className="rounded-lg px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100">Fechar</button>
            </div>
            <div className="max-h-[55vh] overflow-y-auto p-2">
              {!normalizedSearch ? (
                <p className="px-3 py-6 text-center text-sm text-slate-400">A busca consulta os agendamentos desta semana.</p>
              ) : searchResults.length ? (
                searchResults.map((appointment) => (
                  <button
                    key={appointment.id}
                    type="button"
                    onClick={() => {
                      setSelectedDay(appointment.dayKey);
                      setView("Dia");
                      setShowSearch(false);
                      setSearchQuery("");
                      document.getElementById("dashboard-calendar")?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                    className="flex w-full items-center justify-between gap-4 rounded-xl px-3 py-3 text-left hover:bg-indigo-50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-slate-800">{appointment.clientName}</span>
                      <span className="mt-1 block truncate text-xs text-slate-500">{appointment.serviceName} · {appointment.professionalName}</span>
                    </span>
                    <span className="shrink-0 text-right text-xs text-slate-500">{appointment.time}<br />{new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit" }).format(new Date(`${appointment.dayKey}T12:00:00.000Z`))}</span>
                  </button>
                ))
              ) : (
                <p className="px-3 py-6 text-center text-sm text-slate-400">Nenhum agendamento encontrado nesta semana.</p>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

