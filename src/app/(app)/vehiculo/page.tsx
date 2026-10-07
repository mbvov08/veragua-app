import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireVehiculoAccess } from "@/lib/vehiculo/access";
import { formatDateShortEs } from "@/lib/date";
import { contarPuntosQueEmpeoraron } from "@/lib/vehiculo/comparacion";
import { labelDe, TIPO_USO } from "@/lib/vehiculo/constants";

export default async function VehiculoPage() {
  const session = await requireVehiculoAccess();
  const isStaff = session.user.role === "ADMIN" || session.user.role === "EMPLEADA";

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
          {isStaff && (
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
