import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDateOnly, todayColombia, DIAS_SEMANA } from "@/lib/date";
import { formatCOP } from "@/lib/finanzas/format";
import OrderItemsPicker from "@/components/OrderItemsPicker";
import ClienteAutofill from "@/components/ClienteAutofill";
import ImportarContactoButton from "@/components/ImportarContactoButton";
import SubmitButton from "@/components/SubmitButton";
import ConfirmButton from "@/components/ConfirmButton";
import { crearSuscripcion, renovarSuscripcion, cancelarSuscripcion } from "@/lib/actions/suscripciones";

const ZONA_LABEL: Record<string, string> = {
  LOCAL: "Local",
  PEREIRA: "Ruta Pereira",
  MANIZALES: "Ruta Manizales",
};

const CIUDAD_LABEL: Record<string, string> = {
  LOCAL: "Armenia (local)",
  PEREIRA: "Pereira",
  MANIZALES: "Manizales",
};

export default async function SuscripcionesPage() {
  const today = todayColombia();

  const [clientes, productos, suscripciones] = await Promise.all([
    prisma.cliente.findMany({ orderBy: { nombre: "asc" } }),
    prisma.producto.findMany({ orderBy: [{ categoria: "asc" }, { nombre: "asc" }] }),
    prisma.suscripcion.findMany({
      include: { cliente: true, recurringRule: { include: { items: { include: { producto: true } } } } },
      orderBy: { fechaFin: "desc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold text-verde-800">Suscripciones</h1>
        <Link href="/pedidos" className="btn-outline text-sm">← Volver a Pedidos</Link>
      </div>

      {(() => {
        const activas = suscripciones.filter((s) => s.estado === "activa" && s.fechaFin >= today);
        if (activas.length === 0) return null;
        const porCiudad = new Map<string, number>();
        for (const s of activas) porCiudad.set(s.recurringRule.zona, (porCiudad.get(s.recurringRule.zona) ?? 0) + 1);
        return (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="card">
              <p className="text-xs text-tierra-500">Activas</p>
              <p className="text-xl font-semibold text-verde-700">{activas.length}</p>
            </div>
            {[...porCiudad.entries()].map(([zona, n]) => (
              <div key={zona} className="card">
                <p className="text-xs text-tierra-500">{CIUDAD_LABEL[zona] ?? zona}</p>
                <p className="text-xl font-semibold text-tierra-800">{n}</p>
              </div>
            ))}
          </div>
        );
      })()}

      <details className="card" open={suscripciones.length === 0}>
        <summary className="cursor-pointer text-sm font-semibold text-verde-800">Nueva suscripción</summary>
        <form action={crearSuscripcion} className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Cliente</label>
            <input id="cliente" name="cliente" list="clientes-existentes" required className="input" />
          </div>
          <div>
            <label className="label">Teléfono (opcional)</label>
            <div className="flex items-center gap-2">
              <input id="telefono" name="telefono" className="input" />
              <ImportarContactoButton nombreInputId="cliente" telefonoInputId="telefono" />
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Dirección</label>
            <input id="direccion" name="direccion" required className="input" />
          </div>
          <ClienteAutofill clientes={clientes} />
          <div>
            <label className="label">Zona</label>
            <select id="zona" name="zona" className="input" defaultValue="LOCAL">
              <option value="LOCAL">Local</option>
              <option value="PEREIRA">Ruta Pereira</option>
              <option value="MANIZALES">Ruta Manizales</option>
            </select>
          </div>
          <div>
            <label className="label">Día de entrega</label>
            <select name="diaSemana" required className="input" defaultValue="">
              <option value="" disabled>Selecciona...</option>
              {DIAS_SEMANA.map((d, i) => (
                <option key={i} value={i}>{d}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-tierra-400">
              Verifica que coincida con la ruta disponible en la zona del cliente (Pereira: 1 vez
              por semana, Manizales: 2 veces por semana, Local: cualquier día).
            </p>
          </div>
          <OrderItemsPicker productos={productos} />
          <div>
            <label className="label">Fecha de inicio</label>
            <input type="date" name="fechaInicio" required defaultValue={formatDateOnly(today)} className="input" />
            <p className="mt-1 text-xs text-tierra-400">La suscripción vence 1 mes después de esta fecha.</p>
          </div>
          <div>
            <label className="label">Monto pagado (COP)</label>
            <input type="number" name="montoPagado" min="0" step="1" required className="input" />
          </div>
          <div>
            <label className="label">Método de pago (opcional)</label>
            <input name="metodoPago" className="input" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Notas (opcional)</label>
            <input name="notas" className="input" />
          </div>
          <div className="sm:col-span-2">
            <SubmitButton pendingText="Creando suscripción...">Crear suscripción</SubmitButton>
          </div>
        </form>
      </details>

      <div className="card space-y-3">
        <h2 className="text-sm font-semibold text-verde-800">Suscripciones</h2>
        {suscripciones.length === 0 ? (
          <p className="text-sm text-tierra-500">Todavía no hay suscripciones registradas.</p>
        ) : (
          <div className="divide-y divide-verde-50">
            {suscripciones.map((s) => {
              const vencida = s.estado === "activa" && s.fechaFin < today;
              const estadoLabel = s.estado === "cancelada" ? "Cancelada" : vencida ? "Vencida" : "Activa";
              const estadoColor =
                s.estado === "cancelada" ? "text-tierra-400" : vencida ? "text-red-600" : "text-verde-700";
              return (
                <details key={s.id} className="group py-2">
                  <summary className="flex cursor-pointer list-none items-center gap-3 rounded-lg px-1 py-2 hover:bg-verde-50/60">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-tierra-800">{s.cliente.nombre}</p>
                      <p className="text-xs text-tierra-500">
                        {CIUDAD_LABEL[s.recurringRule.zona] ?? ZONA_LABEL[s.recurringRule.zona]} · {DIAS_SEMANA[s.recurringRule.diaSemana]} ·{" "}
                        {formatDateOnly(s.fechaInicio)} a {formatDateOnly(s.fechaFin)}
                      </p>
                    </div>
                    <span className={`text-xs font-semibold ${estadoColor}`}>{estadoLabel}</span>
                    <span className="text-sm font-semibold text-tierra-800">{formatCOP(s.montoPagado)}</span>
                  </summary>

                  <div className="mt-2 space-y-3 rounded-lg border border-verde-100 bg-verde-50/40 p-3">
                    {s.recurringRule.items.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-tierra-600">Productos:</p>
                        <ul className="list-inside list-disc text-xs text-tierra-600">
                          {s.recurringRule.items.map((it) => (
                            <li key={it.id}>{it.producto.nombre}{it.cantidad ? ` — ${it.cantidad}` : ""}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {s.estado === "activa" && (
                      <div className="flex flex-wrap items-end gap-2">
                        <form action={renovarSuscripcion.bind(null, s.id)} className="flex flex-wrap items-end gap-2">
                          <div>
                            <label className="label">Renovar desde</label>
                            <input type="date" name="fechaInicio" required defaultValue={formatDateOnly(s.fechaFin)} className="input w-40" />
                          </div>
                          <div>
                            <label className="label">Monto pagado</label>
                            <input type="number" name="montoPagado" min="0" step="1" required defaultValue={s.montoPagado} className="input w-32" />
                          </div>
                          <div>
                            <label className="label">Método (opcional)</label>
                            <input name="metodoPago" className="input w-32" />
                          </div>
                          <SubmitButton className="btn-secondary">Renovar</SubmitButton>
                        </form>
                        <ConfirmButton
                          action={cancelarSuscripcion.bind(null, s.id)}
                          confirmMessage="¿Cancelar esta suscripción? Deja de generar pedidos nuevos."
                          className="chip-danger"
                        >
                          Cancelar
                        </ConfirmButton>
                      </div>
                    )}
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
