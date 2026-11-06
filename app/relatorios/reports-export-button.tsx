"use client";

type ExportRow = {
  startAt: string;
  client: string;
  professional: string;
  service: string;
  status: string;
  price: number;
};

const statusLabels: Record<string, string> = {
  pending: "Pendente",
  confirmed: "Confirmado",
  in_progress: "Em andamento",
  completed: "Concluído",
  cancelled: "Cancelado",
  no_show: "Não compareceu",
};

export default function ReportsExportButton({ rows, timezone }: { rows: ExportRow[]; timezone: string }) {
  function downloadCsv() {
    const headers = ["Data e hora", "Cliente", "Profissional", "Serviço", "Status", "Valor (R$)"];
    const body = rows.map((row) => [
      new Intl.DateTimeFormat("pt-BR", {
        timeZone: timezone,
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(row.startAt)),
      row.client,
      row.professional,
      row.service,
      statusLabels[row.status] ?? row.status,
      row.price.toFixed(2).replace(".", ","),
    ]);
    const csv = `\uFEFF${[headers, ...body].map((line) => line.map(escapeCsvCell).join(";")).join("\r\n")}`;
    const file = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = `agendamentos-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <button
      type="button"
      onClick={downloadCsv}
      disabled={rows.length === 0}
      className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      Exportar CSV
    </button>
  );
}

function escapeCsvCell(value: string) {
  const safeValue = /^[\s]*[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${safeValue.replace(/"/g, '""')}"`;
}
