import Link from "next/link";
import CompanyPicker from "@/components/finanzas/CompanyPicker";
import TransactionTable from "@/components/finanzas/TransactionTable";
import { resolveCompanyParam, getTransactions } from "@/lib/finanzas/queries";
import { formatCOP } from "@/lib/finanzas/format";
import { addDays, dateOnlyToUTC, dayOfWeek, formatDateOnly, formatDateShortEs, todayColombia } from "@/lib/date";
import { prisma } from "@/lib/prisma";

const TIPOS = [
  { value: "", label: "Todos" },
  { value: "income", label: "Ingresos" },
  { value: "expense", label: "Egresos" },
];

const RANGOS = [
  { value: "hoy", label: "Hoy" },
  { value: "semana", label: "Esta semana" },
  { value: "mes", label: "Este mes" },
  { value: "anio", label: "Este año" },
  { value: "todo", label: "Todo" },
];

type Params = { company?: string; tipo?: string; rango?: string; desde?: string; hasta?: string };

/** Rango de fechas (días calendario, mediodía UTC) según el atajo elegido o las fechas a mano. */
function resolverRango(p: Params): { rango: string; desde?: Date; hasta?: Date } {
  const hoy = todayColombia();
  if (p.desde || p.hasta) {
    return {
      rango: "personalizado",
      desde: p.desde ? dateOnlyToUTC(p.desde) : undefined,
      hasta: p.hasta ? dateOnlyToUTC(p.hasta) : undefined,
    };
  }
  const rango = RANGOS.some((r) => r.value === p.rango) ? p.rango! : "mes";
  const y = hoy.getUTCFullYear();
  const m = hoy.getUTCMonth();
  switch (rango) {
    case "hoy":
      return { rango, desde: hoy, hasta: hoy };
    case "semana": {
      const dow = dayOfWeek(hoy);
      const lunes = addDays(hoy, dow === 0 ? -6 : 1 - dow);
      return { rango, desde: lunes, hasta: addDays(lunes, 6) };
    }
    case "anio":
      return { rango, desde: new Date(Date.UTC(y, 0, 1, 12)), hasta: new Date(Date.UTC(y, 11, 31, 12)) };
    case "todo":
      return { rango };
    default:
      return { rango: "mes", desde: new Date(Date.UTC(y, m, 1, 12)), hasta: new Date(Date.UTC(y, m + 1, 0, 12)) };
  }
}

export default async function MovimientosPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const selection = resolveCompanyParam(params.company);
  const { rango, desde, hasta } = resolverRango(params);

  const tipo = params.tipo === "income" || params.tipo === "expense" ? params.tipo : undefined;
  const href = (cambios: Partial<Params>) => {
    const base: Params = {
      company: params.company,
      tipo: params.tipo,
      ...(rango === "personalizado" ? { desde: params.desde, hasta: params.hasta } : { rango }),
    };
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...base, ...cambios })) if (v) q.set(k, v);
    return `/finanzas/movimientos${q.size ? `?${q}` : ""}`;
  };

  const filtroFecha = desde || hasta ? { gte: desde, lte: hasta } : undefined;
  const [perCompany, grupos] = await Promise.all([
    Promise.all(selection.targets.map((c) => getTransactions({ company: c, tipo, from: desde, to: hasta }))),
    prisma.finTransaction.groupBy({
      by: ["tipo"],
      where: { company: { in: selection.targets }, anulado: false, fecha: filtroFecha },
      _sum: { monto: true },
    }),
  ]);
  const rows = perCompany.flat().sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  const ingresos = grupos.find((g) => g.tipo === "income")?._sum.monto ?? 0;
  const egresos = grupos.find((g) => g.tipo === "expense")?._sum.monto ?? 0;
  const neto = ingresos - egresos;

  const etiquetaRango =
    !desde && !hasta
      ? "Todo el historial"
      : `${desde ? formatDateShortEs(desde) : "…"} – ${hasta ? formatDateShortEs(hasta) : "…"}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-verde-800">Movimientos</h1>
        <div className="flex flex-wrap items-center gap-2">
          <CompanyPicker current={params.company ?? selection.company ?? ""} />
          {!selection.isConsolidated && (
            <Link href="/finanzas/nuevo" className="btn-primary text-sm">Nuevo movimiento</Link>
          )}
          <Link
            href={`/inventario/proveedores${selection.company ? `?company=${selection.company}` : ""}#registrar-compra`}
            className="btn-secondary text-sm"
          >
            Registrar compra
          </Link>
          <Link
            href={`/api/finanzas/export/movimientos?company=${params.company ?? ""}`}
            className="btn-outline text-sm"
          >
            Exportar Excel
          </Link>
        </div>
      </div>

      <div className="card space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {RANGOS.map((r) => (
            <Link
              key={r.value}
              href={href({ rango: r.value, desde: undefined, hasta: undefined })}
              className={rango === r.value ? "btn-primary text-sm" : "btn-outline text-sm"}
            >
              {r.label}
            </Link>
          ))}
        </div>
        <form method="get" className="flex flex-wrap items-end gap-2">
          {params.company && <input type="hidden" name="company" value={params.company} />}
          {params.tipo && <input type="hidden" name="tipo" value={params.tipo} />}
          <div>
            <label className="label">Desde</label>
            <input type="date" name="desde" defaultValue={desde ? formatDateOnly(desde) : ""} className="input w-40" />
          </div>
          <div>
            <label className="label">Hasta</label>
            <input type="date" name="hasta" defaultValue={hasta ? formatDateOnly(hasta) : ""} className="input w-40" />
          </div>
          <button type="submit" className={rango === "personalizado" ? "btn-primary text-sm" : "btn-outline text-sm"}>
            Aplicar fechas
          </button>
        </form>
        <p className="text-xs text-tierra-500 capitalize">{etiquetaRango}</p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-verde-50 p-3">
            <p className="text-xs text-tierra-500">Ingresos</p>
            <p className="text-xl font-semibold text-verde-700">{formatCOP(ingresos)}</p>
          </div>
          <div className="rounded-lg bg-tierra-50 p-3">
            <p className="text-xs text-tierra-500">Egresos</p>
            <p className="text-xl font-semibold text-tierra-800">{formatCOP(egresos)}</p>
          </div>
          <div className="rounded-lg bg-dorado-50 p-3">
            <p className="text-xs text-tierra-500">Neto</p>
            <p className={`text-xl font-semibold ${neto < 0 ? "text-red-600" : "text-verde-700"}`}>{formatCOP(neto)}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {TIPOS.map((t) => (
          <Link
            key={t.value}
            href={href({ tipo: t.value })}
            className={(tipo ?? "") === t.value ? "btn-primary text-sm" : "btn-outline text-sm"}
          >
            {t.label}
          </Link>
        ))}
      </div>
      <div className="card">
        <TransactionTable transactions={rows} />
      </div>
    </div>
  );
}
