import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireVehiculoAccess } from "@/lib/vehiculo/access";
import { formatDateOnly, formatDateShortEs, formatDateLongEs, todayColombia } from "@/lib/date";
import { contarPuntosQueEmpeoraron } from "@/lib/vehiculo/comparacion";
import { labelDe, TIPO_USO } from "@/lib/vehiculo/constants";
import { programarRuta, eliminarRutaProgramada, listarProximasRutasProgramadas } from "@/lib/actions/vehiculo-programacion";
import SubmitButton from "@/components/SubmitButton";

export default async function VehiculoPage() {
  const session = await requireVehiculoAccess();
  const isStaff = session.user.role === "ADMIN" || session.user.role === "EMPLEADA";
  const isConductor = session.user.role === "CONDUCTOR";

  const [conductores, proximasRutas] = isStaff
    ? await Promise.all([
        prisma.user.findMany({ where: { role: "CONDUCTOR", activo: true }, orderBy: { name: "asc" } }),
        listarProximasRutasProgramadas(),
      ])
    : [[], []];

  const salidas = await prisma.vehiculoSalida.findMany({
    where: isStaff ? {} : { conductorId: session.user.id },
    orderBy: { checkoutAt: "desc" },
    take: 50,
    include: {
      vehiculo: true,
      conductor: true,
      evaluaciones: true,
      novedades: true,
      recibos: true,
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-verde-800">Vehículo</h1>
        <div className="flex gap-2">
          {(isStaff || isConductor) && (
            <Link href="/vehiculo/nueva" className="btn-primary text-xs">
              Nueva acta de entrega
            </Link>
          )}
          {session.user.role === "ADMIN" && (
            <Link href="/vehiculo/ajustes" className="btn-outline text-xs">
              Ajustes de flota
            </Link>
          )}
        </div>
      </div>

      {isStaff && (
        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-verde-800">Programar rutas con anticipación</h2>
          <p className="text-xs text-tierra-500">
            Avisa con anticipación qué días vas a necesitar al conductor — lo ve en su inicio antes de que llegue el día.
          </p>
          <form action={programarRuta} className="grid gap-3 sm:grid-cols-4">
            <div>
              <label className="label">Conductor</label>
              <select name="conductorId" required className="input">
                {conductores.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Fecha</label>
              <input type="date" name="fecha" required className="input" defaultValue={formatDateOnly(todayColombia())} />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Notas (opcional)</label>
              <input type="text" name="notas" className="input" placeholder="Ej: Ruta Pereira/Manizales" />
            </div>
            <div className="sm:col-span-4">
              <SubmitButton>Programar</SubmitButton>
            </div>
          </form>

          {proximasRutas.length > 0 && (
            <ul className="divide-y divide-verde-50">
              {proximasRutas.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <div>
                    <p className="font-medium capitalize text-tierra-800">
                      {formatDateLongEs(r.fecha)} · {r.conductor.name}
                    </p>
                    {r.notas && <p className="text-xs text-tierra-500">{r.notas}</p>}
                  </div>
                  <form action={eliminarRutaProgramada.bind(null, r.id)}>
                    <SubmitButton className="chip-edit" pendingText="...">Quitar</SubmitButton>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="card overflow-x-auto">
        {salidas.length === 0 ? (
          <p className="text-sm text-tierra-500">Todavía no hay salidas registradas.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-verde-100 text-left text-xs text-tierra-500">
                <th className="py-2 pr-2">Fecha</th>
                <th className="py-2 pr-2">Vehículo</th>
                <th className="py-2 pr-2">Conductor</th>
                <th className="py-2 pr-2">Uso</th>
                <th className="py-2 pr-2">Km recorridos</th>
                <th className="py-2 pr-2">Gastos</th>
                <th className="py-2 pr-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {salidas.map((s) => {
                const evalEntrega = s.evaluaciones.filter((e) => e.momento === "ENTREGA");
                const evalDevolucion = s.evaluaciones.filter((e) => e.momento === "DEVOLUCION");
                const puntosEmpeoraron = s.checkinAt ? contarPuntosQueEmpeoraron(evalEntrega, evalDevolucion) : 0;
                const tieneNovedades = s.novedades.some((n) => n.marcado);
                const gastos = s.recibos.reduce((sum, r) => sum + r.valor, 0);
                const km = s.checkinKm ? s.checkinKm - s.checkoutKm : null;

                return (
                  <tr key={s.id} className="border-b border-verde-50">
                    <td className="py-2 pr-2 whitespace-nowrap">{formatDateShortEs(s.checkoutAt)}</td>
                    <td className="py-2 pr-2">{s.vehiculo.placa}</td>
                    <td className="py-2 pr-2">{s.conductor.name}</td>
                    <td className="py-2 pr-2 text-tierra-500">{labelDe(TIPO_USO, s.tipoUso)}</td>
                    <td className="py-2 pr-2">{km !== null ? km.toLocaleString("es-CO") : "—"}</td>
                    <td className="py-2 pr-2">{gastos > 0 ? `$${gastos.toLocaleString("es-CO")}` : "—"}</td>
                    <td className="py-2 pr-2">
                      <div className="flex flex-wrap gap-1">
                        {!s.checkinAt && <span className="badge bg-verde-100 text-verde-700">En curso</span>}
                        {tieneNovedades && <span className="badge bg-red-100 text-red-700">Con novedades</span>}
                        {puntosEmpeoraron > 0 && (
                          <span className="badge bg-dorado-100 text-tierra-700">{puntosEmpeoraron} puntos empeoraron</span>
                        )}
                        <Link href={`/vehiculo/${s.id}`} className="chip-edit">
                          Ver
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
