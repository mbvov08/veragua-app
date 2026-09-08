import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDateOnly, formatDateShortEs, todayColombia } from "@/lib/date";
import {
  deletePayrollSlip,
  generateLiquidacion,
  generatePayrollSlip,
  generatePrimaSemestral,
  generateCesantiasConsignacion,
  generatePagoGalpon,
  deletePagoGalpon,
} from "@/lib/actions/payroll";
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

  const [empleados, galponUsers, slips, liquidaciones, primaPagos, cesantiasConsignaciones, pagosGalpon] =
    await Promise.all([
      prisma.user.findMany({ where: { role: "EMPLEADA" }, include: { employeeProfile: true }, orderBy: { name: "asc" } }),
      prisma.user.findMany({ where: { role: "GALPON" }, orderBy: { name: "asc" } }),
      prisma.payrollSlip.findMany({
        include: { user: { include: { employeeProfile: true } } },
        orderBy: { periodStart: "desc" },
        take: 20,
      }),
      prisma.liquidacion.findMany({ include: { user: true }, orderBy: { generatedAt: "desc" }, take: 10 }),
      prisma.primaPago.findMany({ include: { user: true }, orderBy: { generatedAt: "desc" }, take: 10 }),
      prisma.cesantiasConsignacion.findMany({ include: { user: true }, orderBy: { generatedAt: "desc" }, take: 10 }),
      prisma.pagoGalpon.findMany({ include: { user: true }, orderBy: { periodStart: "desc" }, take: 20 }),
    ]);

  const anioActual = today.getUTCFullYear();
  const mesActual = today.getUTCMonth();
  const semestreActual = mesActual < 6 ? 1 : 2;

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
          <div>
            <label className="label">Extra fijo esta quincena ($)</label>
            <input
              type="number"
              step="1"
              name="extraFijo"
              className="input"
              defaultValue={empleados[0]?.employeeProfile?.extraQuincenal ?? 0}
            />
          </div>
          <div>
            <label className="label">Descuento por faltante (opcional, $)</label>
            <input type="number" step="1" name="descuentoFaltante" className="input" defaultValue={0} />
          </div>
          <div className="sm:col-span-3">
            <label className="label">Concepto del descuento</label>
            <input type="text" name="descuentoFaltanteConcepto" className="input" placeholder="Ej. faltante de caja del 5 de sept." />
          </div>
          <div className="sm:col-span-4">
            <button type="submit" className="btn-primary">Calcular</button>
          </div>
          <p className="sm:col-span-4 text-xs text-tierra-400">
            El extra fijo (domicilios u otro concepto) se toma por defecto del perfil en Ajustes; puedes
            cambiarlo aquí solo para esta quincena.
          </p>
        </form>
      </details>

      <div className="card overflow-x-auto">
        <h2 className="mb-3 text-sm font-semibold text-verde-800">Historial de nómina</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-verde-100 text-left text-xs text-tierra-500">
              <th className="py-2 pr-2">Periodo</th>
              <th className="py-2 pr-2">Empleado(a)</th>
              <th className="py-2 pr-2">Base quincena</th>
              <th className="py-2 pr-2">Extra</th>
              <th className="py-2 pr-2">Aux. transp.</th>
              <th className="py-2 pr-2">Devengado</th>
              <th className="py-2 pr-2">Deducciones</th>
              <th className="py-2 pr-2">Faltante</th>
              <th className="py-2 pr-2">Neto a pagar</th>
              <th className="py-2 pr-2"></th>
            </tr>
          </thead>
          <tbody>
            {slips.map((s) => (
              <tr key={s.id} className="border-b border-verde-50">
                <td className="py-2 pr-2">{formatDateShortEs(s.periodStart)} — {formatDateShortEs(s.periodEnd)}</td>
                <td className="py-2 pr-2">
                  {s.user.name}
                  {s.user.employeeProfile?.cedula && (
                    <span className="block text-xs text-tierra-400">CC {s.user.employeeProfile.cedula}</span>
                  )}
                </td>
                <td className="py-2 pr-2">{COP.format(s.salarioBase / 2)}</td>
                <td className="py-2 pr-2">
                  {s.extraFijo > 0 ? `${COP.format(s.extraFijo)} (${s.extraFijoLabel ?? "extra"})` : "—"}
                </td>
                <td className="py-2 pr-2">{COP.format(s.auxTransporte)}</td>
                <td className="py-2 pr-2">{COP.format(s.totalDevengado)}</td>
                <td className="py-2 pr-2">{COP.format(s.totalDeducciones)}</td>
                <td className="py-2 pr-2 text-red-600">
                  {s.descuentoFaltante > 0 ? `- ${COP.format(s.descuentoFaltante)}` : "—"}
                  {s.descuentoFaltanteConcepto && (
                    <span className="block text-xs text-tierra-400">{s.descuentoFaltanteConcepto}</span>
                  )}
                </td>
                <td className="py-2 pr-2 font-semibold text-verde-700">{COP.format(s.netoPagar)}</td>
                <td className="py-2 pr-2 whitespace-nowrap">
                  <a href={`/api/nomina/pdf/${s.id}`} className="mr-3 text-xs text-verde-700 hover:underline">
                    PDF
                  </a>
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
              <tr><td colSpan={9} className="py-6 text-center text-tierra-500">Aún no se ha generado ninguna nómina.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <details className="card" open>
        <summary className="cursor-pointer text-sm font-semibold text-verde-800">Prima de servicios (semestral)</summary>
        <p className="mt-2 text-xs text-tierra-500">
          Por ley se paga dos veces al año a toda empleada activa: antes del 30 de junio (1er semestre) y
          antes del 20 de diciembre (2do semestre).
        </p>
        <form action={generatePrimaSemestral} className="mt-4 grid gap-3 sm:grid-cols-4">
          <div>
            <label className="label">Empleado(a)</label>
            <select name="userId" required className="input">
              {empleados.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Año</label>
            <input type="number" name="anio" required className="input" defaultValue={anioActual} />
          </div>
          <div>
            <label className="label">Semestre</label>
            <select name="semestre" className="input" defaultValue={semestreActual}>
              <option value={1}>1 (ene–jun, pago 30 jun)</option>
              <option value={2}>2 (jul–dic, pago 20 dic)</option>
            </select>
          </div>
          <div className="flex items-end">
            <button type="submit" className="btn-primary w-full">Calcular prima</button>
          </div>
        </form>
      </details>

      {primaPagos.length > 0 && (
        <div className="card overflow-x-auto">
          <h2 className="mb-3 text-sm font-semibold text-verde-800">Primas calculadas</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-verde-100 text-left text-xs text-tierra-500">
                <th className="py-2 pr-2">Empleado(a)</th>
                <th className="py-2 pr-2">Periodo</th>
                <th className="py-2 pr-2">Días base</th>
                <th className="py-2 pr-2">Valor prima</th>
              </tr>
            </thead>
            <tbody>
              {primaPagos.map((p) => (
                <tr key={p.id} className="border-b border-verde-50">
                  <td className="py-2 pr-2">{p.user.name}</td>
                  <td className="py-2 pr-2">{p.anio} — semestre {p.semestre}</td>
                  <td className="py-2 pr-2">{p.diasBase}</td>
                  <td className="py-2 pr-2 font-semibold text-verde-700">{COP.format(p.valorPrima)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <details className="card">
        <summary className="cursor-pointer text-sm font-semibold text-verde-800">Cesantías anuales (consignación)</summary>
        <p className="mt-2 text-xs text-tierra-500">
          Cálculo informativo de lo que corresponde consignar al fondo de cesantías antes del 14 de
          febrero del año siguiente. No se le paga directamente a la empleada.
        </p>
        <form action={generateCesantiasConsignacion} className="mt-4 grid gap-3 sm:grid-cols-3">
          <div>
            <label className="label">Empleado(a)</label>
            <select name="userId" required className="input">
              {empleados.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Año</label>
            <input type="number" name="anio" required className="input" defaultValue={anioActual} />
          </div>
          <div className="flex items-end">
            <button type="submit" className="btn-primary w-full">Calcular cesantías</button>
          </div>
        </form>
      </details>

      {cesantiasConsignaciones.length > 0 && (
        <div className="card overflow-x-auto">
          <h2 className="mb-3 text-sm font-semibold text-verde-800">Cesantías por consignar</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-verde-100 text-left text-xs text-tierra-500">
                <th className="py-2 pr-2">Empleado(a)</th>
                <th className="py-2 pr-2">Año</th>
                <th className="py-2 pr-2">Días base</th>
                <th className="py-2 pr-2">Cesantías</th>
                <th className="py-2 pr-2">Intereses (12%)</th>
                <th className="py-2 pr-2">Total a consignar</th>
              </tr>
            </thead>
            <tbody>
              {cesantiasConsignaciones.map((c) => (
                <tr key={c.id} className="border-b border-verde-50">
                  <td className="py-2 pr-2">{c.user.name}</td>
                  <td className="py-2 pr-2">{c.anio}</td>
                  <td className="py-2 pr-2">{c.diasBase}</td>
                  <td className="py-2 pr-2">{COP.format(c.valorCesantias)}</td>
                  <td className="py-2 pr-2">{COP.format(c.valorIntereses)}</td>
                  <td className="py-2 pr-2 font-semibold text-verde-700">
                    {COP.format(c.valorCesantias + c.valorIntereses)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {galponUsers.length > 0 && (
        <>
          <details className="card" open>
            <summary className="cursor-pointer text-sm font-semibold text-verde-800">
              Pago por producción — galpón
            </summary>
            <p className="mt-2 text-xs text-tierra-500">
              Se paga por cubeta (30 huevos en buen estado por defecto, configurable en Ajustes), usando el
              menor valor entre lo que el encargado registró y lo que efectivamente llegó al local en el
              periodo — así se verifica que coincida.
            </p>
            <form action={generatePagoGalpon} className="mt-4 grid gap-3 sm:grid-cols-4">
              <div>
                <label className="label">Encargado(a)</label>
                <select name="userId" required className="input">
                  {galponUsers.map((u) => (
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
                <button type="submit" className="btn-primary w-full">Calcular pago</button>
              </div>
            </form>
          </details>

          {pagosGalpon.length > 0 && (
            <div className="card overflow-x-auto">
              <h2 className="mb-3 text-sm font-semibold text-verde-800">Pagos al galpón generados</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-verde-100 text-left text-xs text-tierra-500">
                    <th className="py-2 pr-2">Periodo</th>
                    <th className="py-2 pr-2">Encargado(a)</th>
                    <th className="py-2 pr-2">Buenos (galpón)</th>
                    <th className="py-2 pr-2">Recibido (local)</th>
                    <th className="py-2 pr-2">Verificado</th>
                    <th className="py-2 pr-2">Cubetas</th>
                    <th className="py-2 pr-2">Total a pagar</th>
                    <th className="py-2 pr-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {pagosGalpon.map((p) => (
                    <tr key={p.id} className="border-b border-verde-50">
                      <td className="py-2 pr-2">{formatDateShortEs(p.periodStart)} — {formatDateShortEs(p.periodEnd)}</td>
                      <td className="py-2 pr-2">{p.user.name}</td>
                      <td className="py-2 pr-2">{p.huevosProducidos - p.huevosRotos}</td>
                      <td className="py-2 pr-2">{p.huevosRecibidosLocal}</td>
                      <td className="py-2 pr-2">{p.huevosVerificados}</td>
                      <td className="py-2 pr-2">{p.cubetas.toFixed(2)}</td>
                      <td className="py-2 pr-2 font-semibold text-verde-700">{COP.format(p.totalPagar)}</td>
                      <td className="py-2 pr-2 whitespace-nowrap">
                        <a href={`/api/nomina/pdf-galpon/${p.id}`} className="mr-3 text-xs text-verde-700 hover:underline">
                          PDF
                        </a>
                        <ConfirmButton
                          action={deletePagoGalpon.bind(null, p.id)}
                          confirmMessage="¿Eliminar este pago generado?"
                          className="text-xs text-red-600 hover:underline"
                        >
                          Eliminar
                        </ConfirmButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

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
