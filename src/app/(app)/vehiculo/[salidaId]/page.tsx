import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireVehiculoAccess, requireOwnSalida } from "@/lib/vehiculo/access";
import { formatDateShortEs, formatTimeCo } from "@/lib/date";
import { ANGULOS, PUNTOS_EVALUACION, EQUIPAMIENTO_ITEMS } from "@/lib/vehiculo/constants";

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
  const evalEntrega = salidaCompleta.evaluaciones.filter((e) => e.momento === "ENTREGA");
  const equipoEntrega = salidaCompleta.equipamiento.filter((e) => e.momento === "ENTREGA");

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
        <span className={`badge ${salidaCompleta.checkinAt ? "bg-tierra-100 text-tierra-600" : "bg-verde-100 text-verde-700"}`}>
          {salidaCompleta.checkinAt ? "Cerrada" : "En curso"}
        </span>
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
            {salidaCompleta.checkinAt && formatDateShortEs(salidaCompleta.checkinAt)} {salidaCompleta.checkinAt && formatTimeCo(salidaCompleta.checkinAt)} · recibió {salidaCompleta.checkinPor?.name}
          </p>
          <p className="text-sm text-tierra-700">
            Km: {salidaCompleta.checkinKm?.toLocaleString("es-CO")} · Combustible: {salidaCompleta.checkinCombustible}
          </p>
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
    </div>
  );
}
