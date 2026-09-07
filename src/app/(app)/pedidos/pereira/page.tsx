import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { addDays, formatDateOnly, formatDateLongEs, todayColombia } from "@/lib/date";
import DeliveredToggle from "@/components/DeliveredToggle";

export default async function PereiraPage() {
  const today = todayColombia();
  const horizon = addDays(today, 45);

  const orders = await prisma.order.findMany({
    where: {
      zona: "PEREIRA",
      fechaEntrega: { gte: today, lte: horizon },
    },
    orderBy: [{ fechaEntrega: "asc" }, { cliente: "asc" }],
  });

  const grouped = new Map<string, typeof orders>();
  for (const o of orders) {
    const key = formatDateOnly(o.fechaEntrega);
    grouped.set(key, [...(grouped.get(key) ?? []), o]);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-verde-800">Ruta Pereira</h1>
        <Link href="/pedidos" className="text-sm text-verde-700 underline">← Todos los pedidos</Link>
      </div>
      <p className="text-sm text-tierra-500">
        Pedidos agrupados por día de entrega para organizar la ruta antes de salir a repartir.
      </p>

      {[...grouped.entries()].map(([dateKey, dayOrders]) => {
        const pendientes = dayOrders.filter((o) => !o.entregado).length;
        return (
          <div key={dateKey} className="card">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-verde-800 capitalize">
                {formatDateLongEs(dayOrders[0].fechaEntrega)}
              </h2>
              <span className="badge bg-tierra-100 text-tierra-700">{pendientes} pendientes</span>
            </div>
            <ul className="divide-y divide-verde-50">
              {dayOrders.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div>
                    <p className={`text-sm font-medium ${o.entregado ? "text-tierra-400 line-through" : "text-tierra-800"}`}>
                      {o.cliente}
                    </p>
                    <p className="text-xs text-tierra-500">{o.direccion} · {o.telefono}</p>
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
        <p className="text-center text-sm text-tierra-500">No hay pedidos programados para la ruta Pereira.</p>
      )}
    </div>
  );
}
