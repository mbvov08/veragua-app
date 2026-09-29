import Link from "next/link";
import CompanyPicker from "@/components/finanzas/CompanyPicker";
import TrendChart from "@/components/finanzas/TrendChart";
import {
  resolveCompanyParam,
  getPnlRows,
  getMonthlyTrend,
  mergePnlRows,
  mergeMonthlyTrend,
  COMPANY_LABEL,
} from "@/lib/finanzas/queries";
import { buildPnlStatement } from "@/lib/finanzas/calculations";
import { resolvePeriod } from "@/lib/finanzas/period";
import { formatCOP } from "@/lib/finanzas/format";

function Kpi({ label, value, tone }: { label: string; value: number; tone?: "positive" | "negative" }) {
  return (
    <div className="card">
      <p className="text-xs font-medium text-tierra-500">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${tone === "negative" ? "text-red-600" : tone === "positive" ? "text-verde-700" : "text-tierra-800"}`}>
        {formatCOP(value)}
      </p>
    </div>
  );
}

export default async function FinanzasDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string }>;
}) {
  const params = await searchParams;
  const period = resolvePeriod({});
  const selection = resolveCompanyParam(params.company);

  const [pnlRowSets, trendSets] = await Promise.all([
    Promise.all(selection.targets.map((c) => getPnlRows(c, period.start, period.end))),
    Promise.all(selection.targets.map((c) => getMonthlyTrend(c, 6, new Date()))),
  ]);

  const statement = buildPnlStatement(mergePnlRows(pnlRowSets));
  const trend = mergeMonthlyTrend(trendSets);

  const topGastos = [
    ...statement.costoVenta.rows,
    ...statement.gastoAdmin.rows,
    ...statement.gastoVentas.rows,
    ...statement.gastoNoOperacional.rows,
    ...statement.impuesto.rows,
  ]
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const title = selection.isConsolidated ? "Consolidado Veragua + Melcoch" : COMPANY_LABEL[selection.company!];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-verde-800">Finanzas</h1>
          <p className="text-sm text-tierra-500">{title} · {period.label}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CompanyPicker current={params.company ?? selection.company ?? ""} />
          <Link href="/finanzas/nuevo" className="btn-primary text-sm">Nuevo movimiento</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Ingresos del mes" value={statement.ingresosOperacionales.total} tone="positive" />
        <Kpi label="Costo de ventas" value={statement.costoVenta.total} />
        <Kpi label="Utilidad operacional" value={statement.utilidadOperacional} />
        <Kpi label="Utilidad neta" value={statement.utilidadNeta} tone={statement.utilidadNeta >= 0 ? "positive" : "negative"} />
      </div>

      <div className="card">
        <h2 className="mb-3 text-sm font-semibold text-verde-800">Ingresos vs. Egresos (últimos 6 meses)</h2>
        <TrendChart data={trend} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 text-sm font-semibold text-verde-800">Top 5 categorías de gasto — {period.label}</h2>
          {topGastos.length === 0 ? (
            <p className="text-sm text-tierra-500">Sin gastos registrados este período.</p>
          ) : (
            <div className="space-y-2">
              {topGastos.map((g) => (
                <div key={g.category_id} className="flex justify-between text-sm">
                  <span className="text-tierra-500">{g.category_code} · {g.category_name}</span>
                  <span className="font-medium text-tierra-800">{formatCOP(g.total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card space-y-3">
          <h2 className="text-sm font-semibold text-verde-800">¿Vale la pena el punto de venta físico?</h2>
          <p className="text-sm text-tierra-500">
            Compara el margen de contribución de cada canal (Local, Domicilio, etc.) para responder
            esta pregunta con datos.
          </p>
          <Link href="/finanzas/canales" className="btn-outline block text-center text-sm">
            Ver margen por canal
          </Link>
        </div>
      </div>
    </div>
  );
}
