import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireVehiculoAccess, requireOwnSalida } from "@/lib/vehiculo/access";
import { dateOnlyToUTC, formatDateShortEs, formatTimeCo } from "@/lib/date";
import { ANGULOS, PUNTOS_EVALUACION, EQUIPAMIENTO_ITEMS, NOVEDAD_TIPOS, TIPO_RECIBO, labelDe } from "@/lib/vehiculo/constants";
import { comparePuntos } from "@/lib/vehiculo/comparacion";
import { actualizarNotasAdminSalida, registrarDanioFinanciero, actualizarEstadoDanio } from "@/lib/actions/vehiculo";
import {
  listarPedidosDelDia,
  toggleParadaCompletada,
  asignarPedidoASalida,
  quitarPedidoDeSalida,
  marcarPedidoEntregadoStaff,
} from "@/lib/actions/vehiculo-entregas";
import { ESTADO_DANIO } from "@/lib/vehiculo/constants";
import SubmitButton from "@/components/SubmitButton";
import AgregarReciboForm from "@/components/vehiculo/AgregarReciboForm";

/** Día calendario (Colombia, UTC-5) en que se abrió la salida, como YYYY-MM-DD. */
function diaColombia(d: Date) {
  return new Date(d.getTime() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export default async function VehiculoSalidaDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ salidaId: string }>;
  searchParams: Promise<{ fecha?: string }>;
}) {
  const session = await requireVehiculoAccess();
  const { salidaId } = await params;
  const { fecha: fechaParam } = await searchParams;

  try {
    await requireOwnSalida(session, salidaId);
  } catch {
    notFound();
  }

  const salidaCompleta = await prisma.vehiculoSalida.findUnique({
    where: { id: salidaId },
    include: {
      vehiculo: true,
      conductor: true,
      checkoutPor: true,
      checkinPor: true,
      fotos: { include: { archivo: true } },
      evaluaciones: true,
      equipamiento: true,
      novedades: true,
      recibos: { include: { archivo: true } },
      danios: true,
      paradas: { orderBy: { orden: "asc" } },
    },
  });
  if (!salidaCompleta) notFound();

  const isStaff = session.user.role === "ADMIN" || session.user.role === "EMPLEADA";
  const esConductorDueno = session.user.role === "CONDUCTOR" && salidaCompleta.conductorId === session.user.id;
  const abierta = !salidaCompleta.checkinAt;
  const puedeAutoservicio = (isStaff || esConductorDueno) && abierta;
  // El staff puede seguir cargando peajes, pagos y pedidos aunque la ruta ya esté cerrada.
  const puedeGastos = (isStaff || esConductorDueno) && (abierta || isStaff);

  const fechaAsignar = fechaParam && /^\d{4}-\d{2}-\d{2}$/.test(fechaParam) ? fechaParam : diaColombia(salidaCompleta.checkoutAt);
  const [pedidosAsignados, pedidosAsignables] = await Promise.all([
    salidaCompleta.tipoUso === "RUTA_EMPRESA" ? listarPedidosDelDia(salidaId) : Promise.resolve([]),
    isStaff && salidaCompleta.tipoUso === "RUTA_EMPRESA"
      ? prisma.order.findMany({
          where: { fechaEntrega: dateOnlyToUTC(fechaAsignar), entregaTercero: null, entregado: false, vehiculoSalidaId: null },
          select: {
            id: true,
            cliente: true,
            direccion: true,
            zona: true,
            items: { select: { cantidad: true, producto: { select: { nombre: true } } } },
          },
          orderBy: [{ zona: "asc" }, { cliente: "asc" }],
        })
      : Promise.resolve([]),
  ]);

  const fotosEntrega = salidaCompleta.fotos.filter((f) => f.momento === "ENTREGA");
  const fotosDevolucion = salidaCompleta.fotos.filter((f) => f.momento === "DEVOLUCION");
  const evalEntrega = salidaCompleta.evaluaciones.filter((e) => e.momento === "ENTREGA");
  const evalDevolucion = salidaCompleta.evaluaciones.filter((e) => e.momento === "DEVOLUCION");
  const equipoEntrega = salidaCompleta.equipamiento.filter((e) => e.momento === "ENTREGA");
  const equipoDevolucion = salidaCompleta.equipamiento.filter((e) => e.momento === "DEVOLUCION");
  const comparacion = salidaCompleta.checkinAt ? comparePuntos(evalEntrega, evalDevolucion) : [];
  const novedadesMarcadas = salidaCompleta.novedades.filter((n) => n.marcado);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-verde-800">
            {salidaCompleta.vehiculo.placa} · {salidaCompleta.conductor.name}
          </h1>
          <p className="text-sm text-tierra-500">
            {salidaCompleta.tipoUso === "RUTA_EMPRESA" ? "Ruta de la empresa" : "Alquiler"}
            {salidaCompleta.zona && ` · ${salidaCompleta.zona}`}
            {salidaCompleta.destino && ` · ${salidaCompleta.destino}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {abierta && <span className="badge bg-verde-100 text-verde-700">En curso</span>}
          {novedadesMarcadas.length > 0 && <span className="badge bg-red-100 text-red-700">Con novedades</span>}
          {comparacion.some((c) => c.empeoro) && (
            <span className="badge bg-dorado-100 text-tierra-700">
              {comparacion.filter((c) => c.empeoro).length} puntos empeoraron
            </span>
          )}
        </div>
      </div>

      {puedeAutoservicio && (
        <Link href={`/vehiculo/${salidaId}/devolucion`} className="btn-primary inline-block">
          Terminar ruta
        </Link>
      )}

      <div className="card space-y-2">
        <h2 className="text-sm font-semibold text-verde-800">Partida</h2>
        <p className="text-sm text-tierra-700">
          {formatDateShortEs(salidaCompleta.checkoutAt)} {formatTimeCo(salidaCompleta.checkoutAt)} · registró {salidaCompleta.checkoutPor.name}
        </p>
        <p className="text-sm text-tierra-700">
          Km de partida: {salidaCompleta.checkoutKm.toLocaleString("es-CO")}
          {salidaCompleta.checkoutCombustible && ` · Combustible: ${salidaCompleta.checkoutCombustible}`}
        </p>
        {salidaCompleta.observacionesEntrega && (
          <p className="text-sm text-tierra-600">Observaciones: {salidaCompleta.observacionesEntrega}</p>
        )}

        {fotosEntrega.length > 0 && (
          <div className="grid grid-cols-3 gap-2 pt-2 sm:grid-cols-4">
            {ANGULOS.map((a) => {
              const foto = fotosEntrega.find((f) => f.angulo === a.value);
              return foto ? (
                <a key={a.value} href={`/api/vehiculo/archivo/${foto.archivo.id}`} target="_blank" rel="noreferrer" className="block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/vehiculo/archivo/${foto.archivo.id}`} alt={a.label} className="aspect-square w-full rounded-lg object-cover" />
                  <p className="mt-0.5 text-center text-[10px] text-tierra-500">{a.label}</p>
                </a>
              ) : null;
            })}
          </div>
        )}

        {evalEntrega.length > 0 && (
          <div className="grid gap-2 pt-2 sm:grid-cols-2">
            {PUNTOS_EVALUACION.map((p) => {
              const ev = evalEntrega.find((e) => e.punto === p.value);
              if (!ev) return null;
              return (
                <div key={p.value} className="rounded-lg border border-verde-100 px-2 py-1 text-xs">
                  <span className="font-medium text-tierra-700">{p.label}:</span>{" "}
                  <span className={ev.estado === "BUENO" ? "text-verde-700" : ev.estado === "REGULAR" ? "text-dorado-700" : "text-red-700"}>
                    {ev.estado}
                  </span>
                  {ev.nota && <span className="text-tierra-500"> — {ev.nota}</span>}
                </div>
              );
            })}
          </div>
        )}

        {equipoEntrega.length > 0 && (
          <div className="grid gap-1 pt-2 text-xs sm:grid-cols-2">
            {EQUIPAMIENTO_ITEMS.map((it) => {
              const eq = equipoEntrega.find((e) => e.item === it.value);
              if (!eq) return null;
              return (
                <p key={it.value} className="text-tierra-600">
                  {it.label}: <span className={eq.presente ? "text-verde-700" : "text-red-700"}>{eq.presente ? "Sí" : "No"}</span>
                </p>
              );
            })}
          </div>
        )}
      </div>

      {salidaCompleta.checkinAt && (
        <div className="card space-y-2">
          <h2 className="text-sm font-semibold text-verde-800">Llegada</h2>
          <p className="text-sm text-tierra-700">
            {formatDateShortEs(salidaCompleta.checkinAt)} {formatTimeCo(salidaCompleta.checkinAt)} · registró {salidaCompleta.checkinPor?.name}
          </p>
          <p className="text-sm text-tierra-700">
            Km de llegada: {salidaCompleta.checkinKm?.toLocaleString("es-CO")} (
            {((salidaCompleta.checkinKm ?? 0) - salidaCompleta.checkoutKm).toLocaleString("es-CO")} recorridos)
            {salidaCompleta.checkinCombustible && ` · Combustible: ${salidaCompleta.checkinCombustible}`}
          </p>
          {salidaCompleta.observacionesDevolucion && (
            <p className="text-sm text-tierra-600">Observaciones: {salidaCompleta.observacionesDevolucion}</p>
          )}

          {fotosDevolucion.length > 0 && (
            <div className="grid grid-cols-3 gap-2 pt-2 sm:grid-cols-4">
              {ANGULOS.map((a) => {
                const foto = fotosDevolucion.find((f) => f.angulo === a.value);
                return foto ? (
                  <a key={a.value} href={`/api/vehiculo/archivo/${foto.archivo.id}`} target="_blank" rel="noreferrer" className="block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/vehiculo/archivo/${foto.archivo.id}`} alt={a.label} className="aspect-square w-full rounded-lg object-cover" />
                    <p className="mt-0.5 text-center text-[10px] text-tierra-500">{a.label}</p>
                  </a>
                ) : null;
              })}
            </div>
          )}

          {evalDevolucion.length > 0 && (
            <div className="grid gap-2 pt-2 sm:grid-cols-2">
              {PUNTOS_EVALUACION.map((p) => {
                const ev = evalDevolucion.find((e) => e.punto === p.value);
                if (!ev) return null;
                const empeoro = comparacion.find((c) => c.punto === p.value)?.empeoro;
                return (
                  <div key={p.value} className={`rounded-lg border px-2 py-1 text-xs ${empeoro ? "border-red-300 bg-red-50" : "border-verde-100"}`}>
                    <span className="font-medium text-tierra-700">{p.label}:</span>{" "}
                    <span className={ev.estado === "BUENO" ? "text-verde-700" : ev.estado === "REGULAR" ? "text-dorado-700" : "text-red-700"}>
                      {ev.estado}
                    </span>
                    {empeoro && <span className="ml-1 text-red-700">(empeoró)</span>}
                    {ev.nota && <span className="text-tierra-500"> — {ev.nota}</span>}
                  </div>
                );
              })}
            </div>
          )}

          {equipoDevolucion.length > 0 && (
            <div className="grid gap-1 pt-2 text-xs sm:grid-cols-2">
              {EQUIPAMIENTO_ITEMS.map((it) => {
                const eq = equipoDevolucion.find((e) => e.item === it.value);
                if (!eq) return null;
                return (
                  <p key={it.value} className="text-tierra-600">
                    {it.label}: <span className={eq.presente ? "text-verde-700" : "text-red-700"}>{eq.presente ? "Sí" : "No"}</span>
                  </p>
                );
              })}
            </div>
          )}

          {novedadesMarcadas.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-2">
              <p className="text-xs font-medium text-red-700">Novedades:</p>
              {novedadesMarcadas.map((n) => (
                <p key={n.id} className="text-xs text-red-700">
                  {NOVEDAD_TIPOS.find((t) => t.value === n.tipo)?.label}: {n.detalle}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {(salidaCompleta.recibos.length > 0 || puedeGastos) && (
        <div className="card space-y-2">
          <h2 className="text-sm font-semibold text-verde-800">{isStaff ? "Gastos de la ruta (tanqueadas, peajes, pagos)" : "Tanqueadas"}</h2>
          <div className="space-y-1">
            {salidaCompleta.recibos.map((r) => (
              <p key={r.id} className="text-sm text-tierra-700">
                {labelDe(TIPO_RECIBO, r.tipo)}: ${r.valor.toLocaleString("es-CO")}{" "}
                {r.galonesOLugar && `(${r.galonesOLugar})`}
                {r.archivo && (
                  <>
                    {" "}—{" "}
                    <a href={`/api/vehiculo/archivo/${r.archivo.id}`} target="_blank" rel="noreferrer" className="text-verde-700 underline">
                      ver recibo
                    </a>
                  </>
                )}
              </p>
            ))}
          </div>
          {puedeGastos && <AgregarReciboForm salidaId={salidaId} soloTanqueo={!isStaff} />}
        </div>
      )}

      {salidaCompleta.paradas.length > 0 && (
        <div className="card space-y-2">
          <h2 className="text-sm font-semibold text-verde-800">Checklist de la ruta</h2>
          <div className="space-y-1">
            {salidaCompleta.paradas.map((p) => (
              <form
                key={p.id}
                action={toggleParadaCompletada.bind(null, p.id, !p.completado)}
                className="flex items-center gap-2 rounded-lg border border-verde-100 px-2 py-1.5"
              >
                <button
                  type="submit"
                  disabled={!puedeAutoservicio}
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs ${
                    p.completado ? "border-verde-500 bg-verde-500 text-white" : "border-tierra-300 bg-white"
                  }`}
                  aria-label={p.completado ? "Marcar como pendiente" : "Marcar como hecho"}
                >
                  {p.completado ? "✓" : ""}
                </button>
                <span className={`text-sm ${p.completado ? "text-tierra-400 line-through" : "text-tierra-800"}`}>
                  {p.titulo}
                </span>
              </form>
            ))}
          </div>
        </div>
      )}

      {salidaCompleta.tipoUso === "RUTA_EMPRESA" && (pedidosAsignados.length > 0 || isStaff) && (
        <div className="card space-y-3">
          <h2 className="text-sm font-semibold text-verde-800">Pedidos de la ruta</h2>
          {pedidosAsignados.length === 0 ? (
            <p className="text-sm text-tierra-500">Todavía no hay pedidos asignados a esta ruta.</p>
          ) : (
            <div className="divide-y divide-verde-50">
              {pedidosAsignados.map((p) => (
                <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-tierra-800">
                      {p.cliente} <span className="badge bg-tierra-100 text-tierra-600">{p.zona}</span>
                    </p>
                    <p className="text-xs text-tierra-500">{p.direccion}{p.telefono && ` · ${p.telefono}`}</p>
                    <p className="text-xs text-tierra-500">
                      {p.items.map((it) => `${it.cantidad ?? ""} ${it.producto.nombre}`).join(", ")}
                    </p>
                    {p.notas && <p className="text-xs text-dorado-700">{p.notas}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    {p.entregado ? <span className="badge bg-verde-100 text-verde-700">Entregado</span> : <span className="badge bg-tierra-100 text-tierra-500">Pendiente</span>}
                    {isStaff && (
                      <>
                        <form action={marcarPedidoEntregadoStaff.bind(null, salidaId, p.id, !p.entregado)}>
                          <SubmitButton className="chip-edit" pendingText="...">
                            {p.entregado ? "Desmarcar" : "Marcar entregado"}
                          </SubmitButton>
                        </form>
                        {!p.entregado && (
                          <form action={quitarPedidoDeSalida.bind(null, salidaId, p.id)}>
                            <SubmitButton className="chip-edit" pendingText="...">Quitar</SubmitButton>
                          </form>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {isStaff && (
            <div className="space-y-2 border-t border-verde-100 pt-3">
              <p className="text-xs font-semibold text-tierra-600">Agregar pedidos a esta ruta</p>
              <form method="get" className="flex flex-wrap items-end gap-2">
                <div>
                  <label className="label">Pedidos del día</label>
                  <input type="date" name="fecha" defaultValue={fechaAsignar} className="input w-40" />
                </div>
                <button type="submit" className="btn-outline text-sm">Ver</button>
              </form>
              {pedidosAsignables.length === 0 ? (
                <p className="text-xs text-tierra-500">No hay pedidos pendientes sin asignar para esa fecha.</p>
              ) : (
                <div className="divide-y divide-verde-50">
                  {pedidosAsignables.map((p) => (
                    <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-tierra-800">
                          {p.cliente} <span className="badge bg-tierra-100 text-tierra-600">{p.zona}</span>
                        </p>
                        <p className="text-xs text-tierra-500">
                          {p.items.map((it) => `${it.cantidad ?? ""} ${it.producto.nombre}`).join(", ") || "Sin productos"}
                        </p>
                      </div>
                      <form action={asignarPedidoASalida.bind(null, salidaId, p.id)}>
                        <SubmitButton className="btn-secondary text-xs" pendingText="...">Agregar a la ruta</SubmitButton>
                      </form>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {salidaCompleta.checkinAt && session.user.role === "ADMIN" && (
        <div className="card space-y-2">
          <h2 className="text-sm font-semibold text-verde-800">Daños y multas</h2>
          {salidaCompleta.danios.length > 0 && (
            <div className="space-y-1">
              {salidaCompleta.danios.map((d) => (
                <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-verde-100 px-2 py-1 text-sm">
                  <span className="text-tierra-700">
                    ${d.valor.toLocaleString("es-CO")} — {d.concepto}
                  </span>
                  <div className="flex gap-1">
                    {ESTADO_DANIO.map((e) => (
                      <form key={e.value} action={actualizarEstadoDanio.bind(null, d.id, e.value)}>
                        <button
                          type="submit"
                          className={`rounded-lg border px-2 py-0.5 text-xs ${
                            d.estado === e.value ? "border-verde-400 bg-verde-50 text-verde-800" : "border-verde-100 text-tierra-500"
                          }`}
                        >
                          {e.label}
                        </button>
                      </form>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          <form action={registrarDanioFinanciero.bind(null, salidaId)} className="flex flex-wrap items-end gap-2">
            <div>
              <label className="label">Valor</label>
              <input type="number" name="valor" min="0" required className="input w-32" />
            </div>
            <div className="flex-1">
              <label className="label">Concepto</label>
              <input name="concepto" required className="input" placeholder="ej. Rayón puerta lateral" />
            </div>
            <SubmitButton className="btn-secondary">Registrar</SubmitButton>
          </form>
        </div>
      )}

      {salidaCompleta.checkinAt && session.user.role === "ADMIN" && (
        <div className="card space-y-2">
          <h2 className="text-sm font-semibold text-verde-800">Notas de administración</h2>
          <form action={actualizarNotasAdminSalida.bind(null, salidaId)} className="flex flex-wrap items-end gap-2">
            <textarea name="notasAdmin" defaultValue={salidaCompleta.notasAdmin ?? ""} rows={2} className="input flex-1" />
            <SubmitButton className="btn-secondary">Guardar</SubmitButton>
          </form>
        </div>
      )}
      {salidaCompleta.checkinAt && session.user.role !== "ADMIN" && salidaCompleta.notasAdmin && (
        <div className="card">
          <h2 className="mb-1 text-sm font-semibold text-verde-800">Notas de administración</h2>
          <p className="text-sm text-tierra-700">{salidaCompleta.notasAdmin}</p>
        </div>
      )}
    </div>
  );
}
