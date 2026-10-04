import CompanyPicker from "@/components/finanzas/CompanyPicker";
import TrendChart from "@/components/finanzas/TrendChart";
import { resolveCompanyParam, COMPANY_LABEL } from "@/lib/finanzas/queries";
import {
  getTopProductos,
  mergeTopProductos,
  getResumenVentas,
  mergeResumenVentas,
  getMonthlyTrendInRange,
} from "@/lib/finanzas/estadisticas";
import { mergeMonthlyTrend } from "@/lib/finanzas/queries";
import { formatCOP } from "@/lib/finanzas/format";
import { dateOnlyToUTC, formatDateOnly, todayColombia } from "@/lib/date";

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="card">
      <p className="text-xs font-medium text-tierra-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-tierra-800">{value}</p>
    </div>
  );
}

function firstOfMonth(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 12, 0, 0));
}

export default async function EstadisticasPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const selection = resolveCompanyParam(params.company);
  const today = todayColombia();

  const start = params.from ? dateOnlyToUTC(params.from) : firstOfMonth(today);
  const end = params.to ? dateOnlyToUTC(params.to) : today;

  const [topProductosSets, resumenSets, trendSets] = await Promise.all([
    Promise.all(selection.targets.map((c) => getTopProductos(c, start, end))),
    Promise.all(selection.targets.map((c) => getResumenVentas(c, start, end))),
    Promise.all(selection.targets.map((c) => getMonthlyTrendInRange(c, start, end))),
  ]);

  const topProductos = mergeTopProductos(topProductosSets);
  const resumen = mergeResumenVentas(resumenSets);
  const trend = mergeMonthlyTrend(trendSets);

  const title = selection.isConsolidated ? "Consolidado Veragua + Melcoch" : COMPANY_LABEL[selection.company!];
  const productoEstrella = topProductos[0] ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-verde-800">Estadísticas</h1>
          <p className="text-sm text-tierra-500">{title}</p>
        </div>
        <CompanyPicker current={params.company ?? selection.company ?? ""} />
      </div>

      <form className="card flex flex-wrap items-end gap-3">
        {params.company && <input type="hidden" name="company" value={params.company} />}
        <div>
          <label className="label">Desde</label>
          <input type="date" name="from" defaultValue={formatDateOnly(start)} className="input" />
        </div>
        <div>
          <label className="label">Hasta</label>
          <input type="date" name="to" defaultValue={formatDateOnly(end)} className="input" />
        </div>
        <button type="submit" className="btn-primary">Aplicar rango</button>
      </form>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Kpi label="Ingresos" value={formatCOP(resumen.ingresosTotales)} />
        <Kpi label="Gastos" value={formatCOP(resumen.gastosTotales)} />
        <Kpi label="Balance" value={formatCOP(resumen.balance)} />
        <Kpi label="N.º de ventas" value={String(resumen.numeroVentas)} />
        <Kpi label="Ticket promedio" value={formatCOP(resumen.ticketPromedio)} />
      </div>

      {productoEstrella && (
        <div className="card">
          <p className="text-xs font-medium text-tierra-500">Producto estrella del período</p>
          <p className="mt-1 text-lg font-semibold text-verde-800">⭐ {productoEstrella.nombre}</p>
          <p className="text-sm text-tierra-500">
            {productoEstrella.unidadesVendidas} unidades · {formatCOP(productoEstrella.ingresoGenerado)} generados
          </p>
        </div>
      )}

      <div className="card">
        <h2 className="mb-3 text-sm font-semibold text-verde-800">Ingresos vs. Egresos en el rango</h2>
        <TrendChart data={trend} />
      </div>

      <div className="card overflow-x-auto">
        <h2 className="mb-3 text-sm font-semibold text-verde-800">Productos más vendidos</h2>
        {topProductos.length === 0 ? (
          <p className="text-sm text-tierra-500">
            No hay ventas con detalle de producto en este rango. Esto solo cuenta ventas registradas
            con productos (Inventario → Ventas), no movimientos importados en bloque.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-verde-100 text-left text-xs text-tierra-500">
                <th className="py-2 pr-2">Producto</th>
                <th className="py-2 pr-2 text-right">Unidades vendidas</th>
                <th className="py-2 pr-2 text-right">Ingreso generado</th>
                <th className="py-2 pr-2 text-right">Precio promedio</th>
              </tr>
            </thead>
            <tbody>
              {topProductos.map((p) => (
                <tr key={p.productoId} className="border-b border-verde-50">
                  <td className="py-2 pr-2 font-medium text-tierra-800">{p.nombre}</td>
                  <td className="py-2 pr-2 text-right">{p.unidadesVendidas}</td>
                  <td className="py-2 pr-2 text-right">{formatCOP(p.ingresoGenerado)}</td>
                  <td className="py-2 pr-2 text-right">{formatCOP(p.precioPromedio)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-tierra-400">
        Ingresos, gastos y ticket promedio son base caja (igual que el PyG) y cubren todo el rango. La
        tabla de productos más vendidos solo refleja ventas registradas con detalle de producto.
      </p>
    </div>
  );
}
