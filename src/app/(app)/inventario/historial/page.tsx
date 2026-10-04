import InventarioCompanyPicker from "@/components/inventario/CompanyPicker";
import { resolveCompanyParam, COMPANY_LABEL } from "@/lib/finanzas/queries";
import { formatDateOnly } from "@/lib/date";
import { prisma } from "@/lib/prisma";

export default async function HistorialInventarioPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string }>;
}) {
  const params = await searchParams;
  const selection = resolveCompanyParam(params.company);
  const company = selection.company ?? "VERAGUA";

  const ajustes = await prisma.finInventoryAdjustment.findMany({
    where: { producto: { company } },
    include: { producto: true, creadoPor: true },
    orderBy: [{ fecha: "desc" }, { createdAt: "desc" }],
    take: 300,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-verde-800">Historial de ajustes — {COMPANY_LABEL[company]}</h1>
        <InventarioCompanyPicker current={company} />
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-verde-100 text-left text-xs text-tierra-500">
              <th className="py-2 pr-2">Fecha</th>
              <th className="py-2 pr-2">Producto</th>
              <th className="py-2 pr-2">Teórico antes</th>
              <th className="py-2 pr-2">Contado</th>
              <th className="py-2 pr-2">Diferencia</th>
              <th className="py-2 pr-2">Motivo</th>
              <th className="py-2 pr-2">Quién</th>
            </tr>
          </thead>
          <tbody>
            {ajustes.map((a) => (
              <tr key={a.id} className="border-b border-verde-50">
                <td className="py-2 pr-2 whitespace-nowrap">{formatDateOnly(a.fecha)}</td>
                <td className="py-2 pr-2">{a.producto.nombre}</td>
                <td className="py-2 pr-2 text-tierra-500">{a.teoricoAntes}</td>
                <td className="py-2 pr-2 text-tierra-500">{a.contado}</td>
                <td className={`py-2 pr-2 font-medium ${a.diferencia < 0 ? "text-red-600" : a.diferencia > 0 ? "text-verde-700" : "text-tierra-500"}`}>
                  {a.diferencia > 0 ? "+" : ""}{a.diferencia}
                </td>
                <td className="py-2 pr-2 text-tierra-500">{a.motivo ?? "—"}</td>
                <td className="py-2 pr-2 text-tierra-500">{a.creadoPor.name ?? a.creadoPor.username}</td>
              </tr>
            ))}
            {ajustes.length === 0 && (
              <tr><td colSpan={7} className="py-6 text-center text-tierra-500">Sin ajustes registrados todavía.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-tierra-400">
        Los ajustes sin motivo vienen de la migración inicial de datos, no de un conteo manual.
      </p>
    </div>
  );
}
