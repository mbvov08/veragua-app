import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { addDays, dateOnlyToUTC, formatDateOnly, formatDateShortEs, todayColombia, DIAS_SEMANA } from "@/lib/date";
import { createOrder, deleteOrder, deleteRecurringRule, toggleRecurringRule } from "@/lib/actions/orders";
import DeliveredToggle from "@/components/DeliveredToggle";
import ConfirmButton from "@/components/ConfirmButton";

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
  const today = todayColombia();
  const from = params.from ? dateOnlyToUTC(params.from) : today;
  const to = params.to ? dateOnlyToUTC(params.to) : addDays(today, 30);

  const orders = await prisma.order.findMany({
    where: {
      fechaEntrega: { gte: from, lte: to },
      ...(params.zona ? { zona: params.zona } : {}),
      ...(params.estado === "pendiente" ? { entregado: false } : {}),
      ...(params.estado === "entregado" ? { entregado: true } : {}),
    },
    orderBy: [{ fechaEntrega: "asc" }, { zona: "asc" }],
  });

  const recurringRules = await prisma.recurringOrderRule.findMany({
    where: { activo: true },
    orderBy: { diaSemana: "asc" },
  });

  const grouped = new Map<string, typeof orders>();
  for (const o of orders) {
    const key = formatDateOnly(o.fechaEntrega);
    grouped.set(key, [...(grouped.get(key) ?? []), o]);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold text-verde-800">Pedidos</h1>
        <Link href="/pedidos/pereira" className="btn-secondary">🚚 Ver ruta Pereira</Link>
      </div>

      <details className="card" open>
        <summary className="cursor-pointer text-sm font-semibold text-verde-800">Nuevo pedido</summary>
        <form action={createOrder} className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Cliente</label>
            <input name="cliente" required className="input" />
          </div>
          <div>
            <label className="label">Teléfono</label>
            <input name="telefono" required className="input" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Dirección</label>
            <input name="direccion" required className="input" />
          </div>
          <div>
            <label className="label">Zona</label>
            <select name="zona" className="input" defaultValue="LOCAL">
              <option value="LOCAL">Local</option>
              <option value="PEREIRA">Ruta Pereira</option>
              <option value="MANIZALES">Ruta Manizales</option>
            </select>
          </div>
          <div>
            <label className="label">Fecha de entrega</label>
            <input type="date" name="fechaEntrega" required className="input" defaultValue={formatDateOnly(today)} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Notas (opcional)</label>
            <input name="notas" className="input" />
          </div>
          <div className="sm:col-span-2 flex items-center gap-2">
            <input type="checkbox" name="recurrente" id="recurrente" className="h-4 w-4" />
            <label htmlFor="recurrente" className="text-sm text-tierra-700">
              Repetir cada semana en este mismo día
            </label>
          </div>
          <div className="sm:col-span-2">
            <button type="submit" className="btn-primary">Crear pedido</button>
          </div>
        </form>
      </details>

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
            <option value="">Todos</option>
            <option value="pendiente">Pendientes</option>
            <option value="entregado">Entregados</option>
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
            <h2 className="mb-2 text-sm font-semibold text-verde-800 capitalize">
              {formatDateShortEs(dayOrders[0].fechaEntrega)}
            </h2>
            <ul className="divide-y divide-verde-50">
              {dayOrders.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div>
                    <p className={`text-sm font-medium ${o.entregado ? "text-tierra-400 line-through" : "text-tierra-800"}`}>
                      {o.cliente} · <span className="badge bg-verde-50 text-verde-700">{ZONA_LABEL[o.zona]}</span>
                    </p>
                    <p className="text-xs text-tierra-500">{o.direccion} · {o.telefono}</p>
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
                  <p className="text-xs text-tierra-500">{r.direccion} · {r.telefono}</p>
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
