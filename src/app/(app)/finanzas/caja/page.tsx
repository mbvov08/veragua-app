import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatCOP } from "@/lib/finanzas/format";
import { formatDateOnly, formatDateShortEs, todayColombia } from "@/lib/date";
import SubmitButton from "@/components/SubmitButton";
import { getSaldoEsperadoCaja, registrarCierreCaja, actualizarBaseInicial } from "@/lib/actions/caja";

export default async function CajaPage() {
  const session = await auth();
  const isAdmin = session?.user?.role === "ADMIN";

  const [esperado, cierres, settings] = await Promise.all([
    getSaldoEsperadoCaja(),
    prisma.cajaCierre.findMany({ include: { creadoPor: true }, orderBy: { fecha: "desc" }, take: 30 }),
    prisma.cajaSettings.findUnique({ where: { id: "singleton" } }),
  ]);

  const hayCierres = cierres.length > 0;

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-verde-800">Cierre de Caja</h1>
      <p className="-mt-4 text-xs text-tierra-500">
        Incluye el efectivo de Veragua y Melcoch juntos — comparten la misma caja física.
      </p>

      <div className="card space-y-3">
        <div>
          <p className="text-xs font-medium text-tierra-500">Efectivo esperado en caja ahora mismo</p>
          <p className="text-2xl font-semibold text-tierra-800">{formatCOP(esperado.saldoEsperado)}</p>
        </div>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <p className="text-xs text-tierra-500">Saldo anterior</p>
            <p className="font-medium text-tierra-800">{formatCOP(esperado.saldoAnterior)}</p>
          </div>
          <div>
            <p className="text-xs text-tierra-500">+ Ventas efectivo</p>
            <p className="font-medium text-verde-700">{formatCOP(esperado.ingresosEfectivo)}</p>
          </div>
          <div>
            <p className="text-xs text-tierra-500">− Gastos efectivo</p>
            <p className="font-medium text-red-600">{formatCOP(esperado.egresosEfectivo)}</p>
          </div>
        </div>
        <p className="text-xs text-tierra-400">
          {esperado.esPrimerCierre
            ? "Todavía no se ha hecho ningún cierre — se cuentan las ventas/gastos en efectivo de hoy sobre la base inicial."
            : `Calculado desde el último cierre (${formatDateOnly(esperado.desde)}).`}
        </p>
      </div>

      {!hayCierres && isAdmin && (
        <details className="card">
          <summary className="cursor-pointer text-sm font-semibold text-verde-800">Base inicial de caja</summary>
          <form action={actualizarBaseInicial} className="mt-3 flex flex-wrap items-end gap-2">
            <div>
              <label className="label">Efectivo con el que arranca la caja</label>
              <input type="number" name="baseInicial" min="0" step="1" defaultValue={settings?.baseInicial ?? 0} required className="input w-40" />
            </div>
            <SubmitButton className="btn-secondary">Guardar</SubmitButton>
          </form>
          <p className="mt-2 text-xs text-tierra-400">Solo se puede cambiar antes del primer cierre.</p>
        </details>
      )}

      <details className="card" open>
        <summary className="cursor-pointer text-sm font-semibold text-verde-800">Contar caja</summary>
        <form action={registrarCierreCaja} className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Fecha</label>
            <input type="date" name="fecha" required defaultValue={formatDateOnly(todayColombia())} className="input" />
          </div>
          <div>
            <label className="label">Efectivo contado</label>
            <input type="number" name="saldoContado" min="0" step="1" required className="input" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Observaciones</label>
            <textarea name="observaciones" rows={2} className="input" />
          </div>
          <div className="sm:col-span-2">
            <SubmitButton>Registrar cierre</SubmitButton>
          </div>
        </form>
      </details>

      <div className="card overflow-x-auto">
        <h2 className="mb-3 text-sm font-semibold text-verde-800">Historial de cierres</h2>
        {cierres.length === 0 ? (
          <p className="text-sm text-tierra-500">Todavía no hay cierres registrados.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-verde-100 text-left text-xs text-tierra-500">
                <th className="py-2 pr-2">Fecha</th>
                <th className="py-2 pr-2 text-right">Esperado</th>
                <th className="py-2 pr-2 text-right">Contado</th>
                <th className="py-2 pr-2 text-right">Diferencia</th>
                <th className="py-2 pr-2">Quién</th>
              </tr>
            </thead>
            <tbody>
              {cierres.map((c) => (
                <tr key={c.id} className="border-b border-verde-50">
                  <td className="whitespace-nowrap py-2 pr-2 capitalize">{formatDateShortEs(c.fecha)}</td>
                  <td className="py-2 pr-2 text-right">{formatCOP(c.saldoEsperado)}</td>
                  <td className="py-2 pr-2 text-right">{formatCOP(c.saldoContado)}</td>
                  <td className={`py-2 pr-2 text-right font-medium ${c.diferencia < 0 ? "text-red-600" : c.diferencia > 0 ? "text-verde-700" : "text-tierra-500"}`}>
                    {c.diferencia > 0 ? "+" : ""}{formatCOP(c.diferencia)}
                  </td>
                  <td className="py-2 pr-2 text-tierra-500">{c.creadoPor.name ?? c.creadoPor.username}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
