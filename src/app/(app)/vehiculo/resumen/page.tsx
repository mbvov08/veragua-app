import Link from "next/link";
import { requireVehiculoAdmin } from "@/lib/vehiculo/access";
import { computeResumenMensual } from "@/lib/vehiculo/resumen";
import { todayColombia } from "@/lib/date";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function parseMonthParam(month?: string) {
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split("-").map(Number);
    return { year: y, monthIndex: m - 1 };
  }
  const today = todayColombia();
  return { year: today.getUTCFullYear(), monthIndex: today.getUTCMonth() };
}

export default async function VehiculoResumenPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  await requireVehiculoAdmin();
  const params = await searchParams;
  const { year, monthIndex } = parseMonthParam(params.month);
  const monthValue = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;

  const filas = await computeResumenMensual(year, monthIndex);

  const prevMonth = `${monthIndex === 0 ? year - 1 : year}-${String(monthIndex === 0 ? 12 : monthIndex).padStart(2, "0")}`;
  const nextMonth = `${monthIndex === 11 ? year + 1 : year}-${String(monthIndex === 11 ? 1 : monthIndex + 2).padStart(2, "0")}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-verde-800">
          Vehículo — Resumen mensual · {MESES[monthIndex]} {year}
        </h1>
        <div className="flex flex-wrap gap-2">
          <Link href={`/vehiculo/resumen?month=${prevMonth}`} className="btn-outline text-xs">← Anterior</Link>
          <Link href={`/vehiculo/resumen?month=${nextMonth}`} className="btn-outline text-xs">Siguiente →</Link>
          <a href={`/api/vehiculo/export/resumen?month=${monthValue}`} className="btn-outline text-xs">
            Exportar Excel
          </a>
        </div>
      </div>

      <div className="card overflow-x-auto">
        {filas.length === 0 ? (
          <p className="text-sm text-tierra-500">Sin salidas cerradas este mes.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-verde-100 text-left text-xs text-tierra-500">
                <th className="py-2 pr-2">Conductor</th>
                <th className="py-2 pr-2">Rutas</th>
                <th className="py-2 pr-2">A pagar</th>
                <th className="py-2 pr-2">Días alquiler</th>
                <th className="py-2 pr-2">A cobrar</th>
                <th className="py-2 pr-2">Combustible/Peajes</th>
                <th className="py-2 pr-2">Pago registrado</th>
                <th className="py-2 pr-2">Daños pendientes</th>
                <th className="py-2 pr-2">Descontados</th>
                <th className="py-2 pr-2">Pagados</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.conductorId} className="border-b border-verde-50">
                  <td className="py-2 pr-2">{f.conductorNombre}</td>
                  <td className="py-2 pr-2">{f.rutasCompletadas}</td>
                  <td className="py-2 pr-2">${f.montoAPagar.toLocaleString("es-CO")}</td>
                  <td className="py-2 pr-2">{f.diasAlquiler}</td>
                  <td className="py-2 pr-2">${f.montoACobrar.toLocaleString("es-CO")}</td>
                  <td className="py-2 pr-2">${f.gastosCombustiblePeajes.toLocaleString("es-CO")}</td>
                  <td className="py-2 pr-2">${f.pagoConductorRegistrado.toLocaleString("es-CO")}</td>
                  <td className="py-2 pr-2 text-red-600">${f.danosPendiente.toLocaleString("es-CO")}</td>
                  <td className="py-2 pr-2">${f.danosDescontado.toLocaleString("es-CO")}</td>
                  <td className="py-2 pr-2">${f.danosPagado.toLocaleString("es-CO")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="text-xs text-tierra-400">
        Daños y multas: acumulado histórico (no solo de este mes), para no perder de vista lo que sigue pendiente.
      </p>
    </div>
  );
}
