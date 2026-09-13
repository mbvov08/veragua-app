import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { addDays, formatDateOnly, formatDateLongEs, todayColombia } from "@/lib/date";
import DeliveredToggle from "@/components/DeliveredToggle";

const ZONA_LABEL: Record<string, string> = {
  PEREIRA: "Pereira",
  MANIZALES: "Manizales",
};

export default async function PereiraPage() {
  const today = todayColombia();
  const horizon = addDays(today, 45);

  // Los pendientes no se ocultan aunque su fecha ya haya pasado (para que no se
  // "pierdan" pedidos que se olvidó marcar como entregados); los entregados sí
  // se acotan al rango normal para no acumular historial aquí indefinidamente.
  const orders = await prisma.order.findMany({
    where: {
      zona: { in: ["PEREIRA", "MANIZALES"] },
      OR: [
        { entregado: false, fechaEntrega: { lte: horizon } },
        { entregado: true, fechaEntrega: { gte: today, lte: horizon } },
      ],
    },
    include: { items: { include: { producto: true } } },
    orderBy: [{ fechaEntrega: "asc" }, { zona: "asc" }, { cliente: "asc" }],
  });

  const grouped = new Map<string, typeof orders>();
  for (const o of orders) {
    const key = formatDateOnly(o.fechaEntrega);
    grouped.set(key, [...(grouped.get(key) ?? []), o]);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-verde-800">Ruta Pereira / Manizales</h1>
        <Link href="/pedidos" className="text-sm text-verde-700 underline">← Todos los pedidos</Link>
      </div>
      <p className="text-sm text-tierra-500">
        Pedidos de ambas rutas agrupados por día de entrega, ya que salen en el mismo vehículo.
      </p>

      {[...grouped.entries()].map(([dateKey, dayOrders]) => {
        const pendientes = dayOrders.filter((o) => !o.entregado).length;
        return (
          <div key={dateKey} className="card">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-verde-800 capitalize">
                {formatDateLongEs(dayOrders[0].fechaEntrega)}
                {dayOrders[0].fechaEntrega < today && pendientes > 0 && (
                  <span className="badge bg-red-100 text-red-700">⚠️ Atrasado</span>
                )}
              </h2>
              <span className="badge bg-tierra-100 text-tierra-700">{pendientes} pendientes</span>
            </div>
            <ul className="divide-y divide-verde-50">
              {dayOrders.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
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
                  <DeliveredToggle orderId={o.id} entregado={o.entregado} />
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      {grouped.size === 0 && (
        <p className="text-center text-sm text-tierra-500">No hay pedidos programados para las rutas Pereira/Manizales.</p>
      )}
    </div>
  );
}
