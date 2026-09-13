import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { addDays, dateOnlyToUTC, formatDateOnly, formatDateShortEs, todayColombia, DIAS_SEMANA } from "@/lib/date";
import { createOrder, deleteOrder, deleteRecurringRule, toggleRecurringRule, updateOrder, guardarRutaDia } from "@/lib/actions/orders";
import DeliveredToggle from "@/components/DeliveredToggle";
import ConfirmButton from "@/components/ConfirmButton";
import OrderItemsPicker from "@/components/OrderItemsPicker";
import ZonaFechaSync from "@/components/ZonaFechaSync";
import SubmitButton from "@/components/SubmitButton";

const ZONA_LABEL: Record<string, string> = {
  LOCAL: "Local",
  PEREIRA: "Ruta Pereira",
  MANIZALES: "Ruta Manizales",
};

export default async function PedidosPage({
  searchParams,
}: {
  searchParams: Promise<{ zona?: string; from?: string; to?: string; estado?: string }>;
}) {
  const params = await searchParams;
  const session = await auth();
  const isAdmin = session?.user?.role === "ADMIN";
  const today = todayColombia();
  const from = params.from ? dateOnlyToUTC(params.from) : today;
  const to = params.to ? dateOnlyToUTC(params.to) : addDays(today, 30);

  const estadoParam = params.estado ?? "";

  // Los pendientes nunca se ocultan por fecha vieja (aunque se les haya pasado la fecha
  // de entrega, deben seguir apareciendo hasta que alguien los marque como entregados).
  // Solo al buscar histórico (entregados/todos) se respeta el rango "desde" elegido.
  const orders = await prisma.order.findMany({
    where: {
      fechaEntrega: estadoParam === "" ? { lte: to } : { gte: from, lte: to },
      ...(params.zona ? { zona: params.zona } : {}),
      ...(estadoParam === "" ? { entregado: false } : {}),
      ...(estadoParam === "entregado" ? { entregado: true } : {}),
      // estadoParam === "todos" => sin filtro de entregado
    },
    include: { items: { include: { producto: true } } },
    orderBy: [{ fechaEntrega: "asc" }, { zona: "asc" }],
  });

  const recurringRules = await prisma.recurringOrderRule.findMany({
    where: { activo: true },
    orderBy: { diaSemana: "asc" },
  });

  const productos = await prisma.producto.findMany({ orderBy: [{ categoria: "asc" }, { nombre: "asc" }] });

  const rutaSettingsRows = await prisma.rutaSettings.findMany();
  const rutaDias: Record<string, number | null> = {
    PEREIRA: rutaSettingsRows.find((r) => r.zona === "PEREIRA")?.diaSemana ?? null,
    MANIZALES: rutaSettingsRows.find((r) => r.zona === "MANIZALES")?.diaSemana ?? null,
  };

  const grouped = new Map<string, typeof orders>();
  for (const o of orders) {
    const key = formatDateOnly(o.fechaEntrega);
    grouped.set(key, [...(grouped.get(key) ?? []), o]);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold text-verde-800">Pedidos</h1>
        <Link href="/pedidos/pereira" className="btn-secondary">🚚 Ver ruta Pereira/Manizales</Link>
      </div>

      <details className="card" open>
        <summary className="cursor-pointer text-sm font-semibold text-verde-800">Nuevo pedido</summary>
        <form action={createOrder} className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Cliente</label>
            <input name="cliente" required className="input" />
          </div>
          <div>
            <label className="label">Teléfono (opcional)</label>
            <input name="telefono" className="input" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Dirección</label>
            <input name="direccion" required className="input" />
          </div>
          <div>
            <label className="label">Zona</label>
            <select id="zona" name="zona" className="input" defaultValue="LOCAL">
              <option value="LOCAL">Local</option>
              <option value="PEREIRA">Ruta Pereira</option>
              <option value="MANIZALES">Ruta Manizales</option>
            </select>
          </div>
          <div>
            <label className="label">Fecha de entrega</label>
            <input
              id="fechaEntrega"
              type="date"
              name="fechaEntrega"
              required
              className="input"
              defaultValue={formatDateOnly(today)}
            />
            {(rutaDias.PEREIRA !== null || rutaDias.MANIZALES !== null) && (
              <p className="mt-1 text-xs text-tierra-400">
                Al elegir Pereira o Manizales, la fecha se ajusta sola al día fijo de esa ruta.
              </p>
            )}
          </div>
          <ZonaFechaSync rutaDias={rutaDias} />
          <OrderItemsPicker productos={productos} />
          <div className="sm:col-span-2">
            <label className="label">Notas adicionales (opcional)</label>
            <input id="notas" name="notas" className="input" placeholder="Cualquier detalle que no sea un producto" />
          </div>
          <div className="sm:col-span-2 flex items-center gap-2">
            <input type="checkbox" name="recurrente" id="recurrente" className="h-4 w-4" />
            <label htmlFor="recurrente" className="text-sm text-tierra-700">
              Repetir cada semana en este mismo día
            </label>
          </div>
          <div className="sm:col-span-2">
            <SubmitButton pendingText="Creando pedido...">Crear pedido</SubmitButton>
          </div>
        </form>
      </details>

      {isAdmin && (
        <details className="card">
          <summary className="cursor-pointer text-sm font-semibold text-verde-800">Días fijos de ruta</summary>
          <p className="mt-2 text-xs text-tierra-500">
            Pereira y Manizales solo salen una vez por semana. Fija aquí el día y la fecha se autocompletará al crear pedidos de esa ruta.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {(["PEREIRA", "MANIZALES"] as const).map((zona) => (
              <form key={zona} action={guardarRutaDia} className="flex items-end gap-2">
                <input type="hidden" name="zona" value={zona} />
                <div className="flex-1">
                  <label className="label">{ZONA_LABEL[zona]}</label>
                  <select name="diaSemana" defaultValue={rutaDias[zona] ?? ""} className="input">
                    <option value="" disabled>Elige un día</option>
                    {DIAS_SEMANA.map((d, i) => (
                      <option key={i} value={i}>{d}</option>
                    ))}
                  </select>
                </div>
                <button type="submit" className="btn-secondary text-xs">Guardar</button>
              </form>
            ))}
          </div>
        </details>
      )}

      <form className="card flex flex-wrap items-end gap-3" method="get">
        <div>
          <label className="label">Zona</label>
          <select name="zona" defaultValue={params.zona ?? ""} className="input">
            <option value="">Todas</option>
            <option value="LOCAL">Local</option>
            <option value="PEREIRA">Ruta Pereira</option>
            <option value="MANIZALES">Ruta Manizales</option>
          </select>
        </div>
        <div>
          <label className="label">Estado</label>
          <select name="estado" defaultValue={params.estado ?? ""} className="input">
            <option value="">Pendientes</option>
            <option value="entregado">Entregados (histórico)</option>
            <option value="todos">Todos</option>
          </select>
        </div>
        <div>
          <label className="label">Desde</label>
          <input type="date" name="from" defaultValue={formatDateOnly(from)} className="input" />
        </div>
        <div>
          <label className="label">Hasta</label>
          <input type="date" name="to" defaultValue={formatDateOnly(to)} className="input" />
        </div>
        <button type="submit" className="btn-primary">Filtrar</button>
      </form>

      <div className="space-y-4">
        {[...grouped.entries()].map(([dateKey, dayOrders]) => (
          <div key={dateKey} className="card">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-verde-800 capitalize">
              {formatDateShortEs(dayOrders[0].fechaEntrega)}
              {dayOrders[0].fechaEntrega < today && dayOrders.some((o) => !o.entregado) && (
                <span className="badge bg-red-100 text-red-700">⚠️ Atrasado</span>
              )}
            </h2>
            <ul className="divide-y divide-verde-50">
              {dayOrders.map((o) => (
                <li key={o.id} className="py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className={`text-sm font-medium ${o.entregado ? "text-tierra-400 line-through" : "text-tierra-800"}`}>
                        {o.cliente} · <span className="badge bg-verde-50 text-verde-700">{ZONA_LABEL[o.zona]}</span>
                      </p>
                      <p className="text-xs text-tierra-500">{o.direccion}{o.telefono && ` · ${o.telefono}`}</p>
                      {o.items.length > 0 && (
                        <ul className="mt-1 list-disc pl-4 text-xs text-tierra-500">
                          {o.items.map((it) => (
                            <li key={it.id}>
                              {it.producto.nombre}
                              {it.cantidad && <> — {it.cantidad}</>}
                            </li>
                          ))}
                        </ul>
                      )}
                      {o.notas && <p className="text-xs text-tierra-400">{o.notas}</p>}
                    </div>
                    <div className="flex items-center gap-3">
                      <DeliveredToggle orderId={o.id} entregado={o.entregado} />
                      <ConfirmButton
                        action={deleteOrder.bind(null, o.id)}
                        confirmMessage="¿Eliminar este pedido?"
                        className="text-xs text-red-600 hover:underline"
                      >
                        Eliminar
                      </ConfirmButton>
                    </div>
                  </div>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-verde-700 hover:underline">Editar</summary>
                    <form
                      action={updateOrder.bind(null, o.id)}
                      className="mt-2 grid gap-2 rounded-lg border border-verde-100 bg-verde-50/30 p-3 sm:grid-cols-2"
                    >
                      <div>
                        <label className="label">Cliente</label>
                        <input name="cliente" defaultValue={o.cliente} required className="input" />
                      </div>
                      <div>
                        <label className="label">Teléfono (opcional)</label>
                        <input name="telefono" defaultValue={o.telefono ?? ""} className="input" />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="label">Dirección</label>
                        <input name="direccion" defaultValue={o.direccion} required className="input" />
                      </div>
                      <div>
                        <label className="label">Zona</label>
                        <select name="zona" defaultValue={o.zona} className="input">
                          <option value="LOCAL">Local</option>
                          <option value="PEREIRA">Ruta Pereira</option>
                          <option value="MANIZALES">Ruta Manizales</option>
                        </select>
                      </div>
                      <div>
                        <label className="label">Fecha de entrega</label>
                        <input
                          type="date"
                          name="fechaEntrega"
                          required
                          className="input"
                          defaultValue={formatDateOnly(o.fechaEntrega)}
                        />
                      </div>
                      <OrderItemsPicker
                        productos={productos}
                        initialItems={o.items.map((it) => ({
                          productoId: it.productoId,
                          nombre: it.producto.nombre,
                          cantidad: it.cantidad ?? "",
                        }))}
                      />
                      <div className="sm:col-span-2">
                        <label className="label">Notas adicionales (opcional)</label>
                        <input name="notas" defaultValue={o.notas ?? ""} className="input" />
                      </div>
                      <div className="sm:col-span-2">
                        <SubmitButton className="btn-secondary text-xs">Guardar cambios</SubmitButton>
                      </div>
                    </form>
                  </details>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {grouped.size === 0 && (
          <p className="text-center text-sm text-tierra-500">No hay pedidos en este rango.</p>
        )}
      </div>

      {recurringRules.length > 0 && (
        <div className="card">
          <h2 className="mb-3 text-sm font-semibold text-verde-800">Pedidos recurrentes activos</h2>
          <ul className="divide-y divide-verde-50">
            {recurringRules.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <div>
                  <p className="font-medium text-tierra-800">
                    {r.cliente} · {DIAS_SEMANA[r.diaSemana]} · {ZONA_LABEL[r.zona]}
                  </p>
                  <p className="text-xs text-tierra-500">{r.direccion}{r.telefono && ` · ${r.telefono}`}</p>
                </div>
                <div className="flex items-center gap-3">
                  <ConfirmButton
                    action={toggleRecurringRule.bind(null, r.id, false)}
                    confirmMessage="¿Pausar este pedido recurrente? No se generarán nuevas fechas."
                    className="text-xs text-tierra-600 hover:underline"
                  >
                    Pausar
                  </ConfirmButton>
                  <ConfirmButton
                    action={deleteRecurringRule.bind(null, r.id)}
                    confirmMessage="¿Eliminar este pedido recurrente y sus fechas futuras pendientes?"
                    className="text-xs text-red-600 hover:underline"
                  >
                    Eliminar
                  </ConfirmButton>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
