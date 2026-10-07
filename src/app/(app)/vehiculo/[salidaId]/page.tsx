import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireVehiculoAccess, requireOwnSalida } from "@/lib/vehiculo/access";
import { formatDateShortEs, formatTimeCo } from "@/lib/date";
import { ANGULOS, PUNTOS_EVALUACION, EQUIPAMIENTO_ITEMS, NOVEDAD_TIPOS } from "@/lib/vehiculo/constants";
import { comparePuntos } from "@/lib/vehiculo/comparacion";
import { actualizarNotasAdminSalida } from "@/lib/actions/vehiculo";
import SubmitButton from "@/components/SubmitButton";

export default async function VehiculoSalidaDetallePage({ params }: { params: Promise<{ salidaId: string }> }) {
  const session = await requireVehiculoAccess();
  const { salidaId } = await params;

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
    },
  });
  if (!salidaCompleta) notFound();

  const isStaff = session.user.role === "ADMIN" || session.user.role === "EMPLEADA";
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
          {!salidaCompleta.checkinAt && <span className="badge bg-verde-100 text-verde-700">En curso</span>}
          {novedadesMarcadas.length > 0 && <span className="badge bg-red-100 text-red-700">Con novedades</span>}
          {comparacion.some((c) => c.empeoro) && (
            <span className="badge bg-dorado-100 text-tierra-700">
              {comparacion.filter((c) => c.empeoro).length} puntos empeoraron
            </span>
          )}
        </div>
      </div>

      {isStaff && !salidaCompleta.checkinAt && (
        <Link href={`/vehiculo/${salidaId}/devolucion`} className="btn-primary inline-block">
          Acta de devolución
        </Link>
      )}

      <div className="card space-y-2">
        <h2 className="text-sm font-semibold text-verde-800">Entrega</h2>
        <p className="text-sm text-tierra-700">
          {formatDateShortEs(salidaCompleta.checkoutAt)} {formatTimeCo(salidaCompleta.checkoutAt)} · entregó {salidaCompleta.checkoutPor.name}
        </p>
        <p className="text-sm text-tierra-700">
          Km: {salidaCompleta.checkoutKm.toLocaleString("es-CO")} · Combustible: {salidaCompleta.checkoutCombustible}
        </p>
        {salidaCompleta.observacionesEntrega && (
          <p className="text-sm text-tierra-600">Observaciones: {salidaCompleta.observacionesEntrega}</p>
        )}

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

        <div className="grid gap-2 pt-2 sm:grid-cols-2">
          {PUNTOS_EVALUACION.map((p) => {
            const ev = evalEntrega.find((e) => e.punto === p.value);
            if (!ev) return null;
            return (
              <div key={p.value} className="rounded-lg border border-verde-100 px-2 py-1 text-xs">
                <span className="font-medium text-tierra-700">{p.label}:</span>{" "}
                <span
                  className={
                    ev.estado === "BUENO" ? "text-verde-700" : ev.estado === "REGULAR" ? "text-dorado-700" : "text-red-700"
                  }
                >
                  {ev.estado}
                </span>
                {ev.nota && <span className="text-tierra-500"> — {ev.nota}</span>}
              </div>
            );
          })}
        </div>

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
      </div>

      {salidaCompleta.checkinAt && (
        <div className="card space-y-2">
          <h2 className="text-sm font-semibold text-verde-800">Devolución</h2>
          <p className="text-sm text-tierra-700">
            {formatDateShortEs(salidaCompleta.checkinAt)} {formatTimeCo(salidaCompleta.checkinAt)} · recibió {salidaCompleta.checkinPor?.name}
          </p>
          <p className="text-sm text-tierra-700">
            Km: {salidaCompleta.checkinKm?.toLocaleString("es-CO")} ({((salidaCompleta.checkinKm ?? 0) - salidaCompleta.checkoutKm).toLocaleString("es-CO")} recorridos) · Combustible: {salidaCompleta.checkinCombustible}
          </p>
          {salidaCompleta.observacionesDevolucion && (
            <p className="text-sm text-tierra-600">Observaciones: {salidaCompleta.observacionesDevolucion}</p>
          )}

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

          <div className="grid gap-2 pt-2 sm:grid-cols-2">
            {PUNTOS_EVALUACION.map((p) => {
              const ev = evalDevolucion.find((e) => e.punto === p.value);
              if (!ev) return null;
              const empeoro = comparacion.find((c) => c.punto === p.value)?.empeoro;
              return (
                <div key={p.value} className={`rounded-lg border px-2 py-1 text-xs ${empeoro ? "border-red-300 bg-red-50" : "border-verde-100"}`}>
                  <span className="font-medium text-tierra-700">{p.label}:</span>{" "}
                  <span
                    className={
                      ev.estado === "BUENO" ? "text-verde-700" : ev.estado === "REGULAR" ? "text-dorado-700" : "text-red-700"
                    }
                  >
                    {ev.estado}
                  </span>
                  {empeoro && <span className="ml-1 text-red-700">(empeoró)</span>}
                  {ev.nota && <span className="text-tierra-500"> — {ev.nota}</span>}
                </div>
              );
            })}
          </div>

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

      {salidaCompleta.recibos.length > 0 && (
        <div className="card space-y-2">
          <h2 className="text-sm font-semibold text-verde-800">Recibos</h2>
          <div className="space-y-1">
            {salidaCompleta.recibos.map((r) => (
              <p key={r.id} className="text-sm text-tierra-700">
                {r.tipo === "COMBUSTIBLE" ? "Tanqueo" : "Peaje"}: ${r.valor.toLocaleString("es-CO")}{" "}
                {r.galonesOLugar && `(${r.galonesOLugar})`} —{" "}
                <a href={`/api/vehiculo/archivo/${r.archivo.id}`} target="_blank" rel="noreferrer" className="text-verde-700 underline">
                  ver recibo
                </a>
              </p>
            ))}
          </div>
        </div>
      )}

      {salidaCompleta.checkinAt && session.user.role === "ADMIN" && (
        <div className="card space-y-2">
          <h2 className="text-sm font-semibold text-verde-800">Notas de administración</h2>
          <p className="text-xs text-tierra-400">
            El acta ya quedó cerrada y es de solo lectura — esto es lo único que se puede seguir editando.
          </p>
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
