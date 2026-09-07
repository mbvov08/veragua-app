import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDateOnly, formatDateShortEs, todayColombia } from "@/lib/date";
import { deletePayrollSlip, generateLiquidacion, generatePayrollSlip } from "@/lib/actions/payroll";
import ConfirmButton from "@/components/ConfirmButton";

const COP = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

function defaultQuincena(today: Date) {
  const day = today.getUTCDate();
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth();
  if (day <= 15) {
    return {
      start: new Date(Date.UTC(year, month, 1, 12)),
      end: new Date(Date.UTC(year, month, 15, 12)),
    };
  }
  const lastDay = new Date(Date.UTC(year, month + 1, 0, 12)).getUTCDate();
  return {
    start: new Date(Date.UTC(year, month, 16, 12)),
    end: new Date(Date.UTC(year, month, lastDay, 12)),
  };
}

export default async function NominaPage() {
  const today = todayColombia();
  const quincena = defaultQuincena(today);

  const [empleados, slips, liquidaciones] = await Promise.all([
    prisma.user.findMany({ where: { role: "EMPLEADA" }, orderBy: { name: "asc" } }),
    prisma.payrollSlip.findMany({ include: { user: true }, orderBy: { periodStart: "desc" }, take: 20 }),
    prisma.liquidacion.findMany({ include: { user: true }, orderBy: { generatedAt: "desc" }, take: 10 }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-verde-800">Nómina</h1>
        <Link href="/nomina/ajustes" className="btn-secondary">⚙ Ajustes de nómina</Link>
      </div>

      <div className="rounded-lg bg-yellow-50 px-3 py-2 text-xs text-yellow-800">
        Cálculo automático de referencia según la Ley 2101 y la normativa vigente. Verifica los valores
        con tu contador antes de pagar, especialmente si cambian el SMLMV o los porcentajes de ley.
      </div>

      {empleados.length === 0 && (
        <p className="text-sm text-tierra-500">
          Primero crea el perfil laboral de la empleada en{" "}
          <Link href="/nomina/ajustes" className="underline text-verde-700">Ajustes</Link>.
        </p>
      )}

      <details className="card" open>
        <summary className="cursor-pointer text-sm font-semibold text-verde-800">Generar nómina quincenal</summary>
        <form action={generatePayrollSlip} className="mt-4 grid gap-3 sm:grid-cols-4">
          <div>
            <label className="label">Empleado(a)</label>
            <select name="userId" required className="input">
              {empleados.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Desde</label>
            <input type="date" name="periodStart" required className="input" defaultValue={formatDateOnly(quincena.start)} />
          </div>
          <div>
            <label className="label">Hasta</label>
            <input type="date" name="periodEnd" required className="input" defaultValue={formatDateOnly(quincena.end)} />
          </div>
          <div className="flex items-end">
            <button type="submit" className="btn-primary w-full">Calcular</button>
          </div>
        </form>
      </details>

      <div className="card overflow-x-auto">
        <h2 className="mb-3 text-sm font-semibold text-verde-800">Historial de nómina</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-verde-100 text-left text-xs text-tierra-500">
              <th className="py-2 pr-2">Periodo</th>
              <th className="py-2 pr-2">Empleado(a)</th>
              <th className="py-2 pr-2">Devengado</th>
              <th className="py-2 pr-2">Deducciones</th>
              <th className="py-2 pr-2">Neto a pagar</th>
              <th className="py-2 pr-2"></th>
            </tr>
          </thead>
          <tbody>
            {slips.map((s) => (
              <tr key={s.id} className="border-b border-verde-50">
                <td className="py-2 pr-2">{formatDateShortEs(s.periodStart)} — {formatDateShortEs(s.periodEnd)}</td>
                <td className="py-2 pr-2">{s.user.name}</td>
                <td className="py-2 pr-2">{COP.format(s.totalDevengado)}</td>
                <td className="py-2 pr-2">{COP.format(s.totalDeducciones)}</td>
                <td className="py-2 pr-2 font-semibold text-verde-700">{COP.format(s.netoPagar)}</td>
                <td className="py-2 pr-2">
                  <ConfirmButton
                    action={deletePayrollSlip.bind(null, s.id)}
                    confirmMessage="¿Eliminar esta nómina generada?"
                    className="text-xs text-red-600 hover:underline"
                  >
                    Eliminar
                  </ConfirmButton>
                </td>
              </tr>
            ))}
            {slips.length === 0 && (
              <tr><td colSpan={6} className="py-6 text-center text-tierra-500">Aún no se ha generado ninguna nómina.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <details className="card" open>
        <summary className="cursor-pointer text-sm font-semibold text-verde-800">Generar liquidación laboral</summary>
        <form action={generateLiquidacion} className="mt-4 grid gap-3 sm:grid-cols-3">
          <div>
            <label className="label">Empleado(a)</label>
            <select name="userId" required className="input">
              {empleados.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Fecha de retiro</label>
            <input type="date" name="fechaRetiro" required className="input" defaultValue={formatDateOnly(today)} />
          </div>
          <div className="flex items-end">
            <button type="submit" className="btn-primary w-full">Calcular liquidación</button>
          </div>
        </form>
      </details>

      {liquidaciones.length > 0 && (
        <div className="card overflow-x-auto">
          <h2 className="mb-3 text-sm font-semibold text-verde-800">Liquidaciones generadas</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-verde-100 text-left text-xs text-tierra-500">
                <th className="py-2 pr-2">Empleado(a)</th>
                <th className="py-2 pr-2">Retiro</th>
                <th className="py-2 pr-2">Días laborados</th>
                <th className="py-2 pr-2">Cesantías</th>
                <th className="py-2 pr-2">Int. cesantías</th>
                <th className="py-2 pr-2">Prima</th>
                <th className="py-2 pr-2">Vacaciones</th>
                <th className="py-2 pr-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {liquidaciones.map((l) => (
                <tr key={l.id} className="border-b border-verde-50">
                  <td className="py-2 pr-2">{l.user.name}</td>
                  <td className="py-2 pr-2">{formatDateShortEs(l.fechaRetiro)}</td>
                  <td className="py-2 pr-2">{l.diasLaborados}</td>
                  <td className="py-2 pr-2">{COP.format(l.cesantias)}</td>
                  <td className="py-2 pr-2">{COP.format(l.interesesCesantias)}</td>
                  <td className="py-2 pr-2">{COP.format(l.prima)}</td>
                  <td className="py-2 pr-2">{COP.format(l.vacaciones)}</td>
                  <td className="py-2 pr-2 font-semibold text-verde-700">{COP.format(l.totalLiquidacion)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
