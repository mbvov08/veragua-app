import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { addDays, dayOfWeek, formatDateOnly, todayColombia } from "@/lib/date";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const ZONA_LABEL: Record<string, string> = { LOCAL: "Local", PEREIRA: "Pereira", MANIZALES: "Manizales" };

function parseMonthParam(month?: string) {
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split("-").map(Number);
    return { year: y, monthIndex: m - 1 };
  }
  const today = todayColombia();
  return { year: today.getUTCFullYear(), monthIndex: today.getUTCMonth() };
}

export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const { year, monthIndex } = parseMonthParam(params.month);

  const firstOfMonth = new Date(Date.UTC(year, monthIndex, 1, 12, 0, 0));
  const lastOfMonth = new Date(Date.UTC(year, monthIndex + 1, 0, 12, 0, 0));

  const gridStartOffset = dayOfWeek(firstOfMonth) === 0 ? -6 : 1 - dayOfWeek(firstOfMonth);
  const gridStart = addDays(firstOfMonth, gridStartOffset);
  const gridEndOffset = dayOfWeek(lastOfMonth) === 0 ? 0 : 7 - dayOfWeek(lastOfMonth);
  const gridEnd = addDays(lastOfMonth, gridEndOffset);

  const [orders, tasks, reminders] = await Promise.all([
    prisma.order.findMany({ where: { fechaEntrega: { gte: gridStart, lte: gridEnd } } }),
    prisma.task.findMany({
      where: { fechaLimite: { gte: gridStart, lte: gridEnd } },
      include: { asignadoA: true },
    }),
    prisma.reminderInstance.findMany({
      where: { fecha: { gte: gridStart, lte: gridEnd } },
      include: { reminderRule: true },
    }),
  ]);

  type DayItem = { label: string; color: string };
  const itemsByDay = new Map<string, DayItem[]>();
  function push(dateKey: string, item: DayItem) {
    itemsByDay.set(dateKey, [...(itemsByDay.get(dateKey) ?? []), item]);
  }
  for (const o of orders) {
    push(formatDateOnly(o.fechaEntrega), {
      label: `📦 ${o.cliente} (${ZONA_LABEL[o.zona]})`,
      color: o.entregado ? "bg-verde-50 text-verde-500 line-through" : "bg-verde-100 text-verde-800",
    });
  }
  for (const t of tasks) {
    if (!t.fechaLimite) continue;
    push(formatDateOnly(t.fechaLimite), {
      label: `✅ ${t.titulo} (${t.asignadoA.name})`,
      color: t.estado === "COMPLETADO" ? "bg-tierra-50 text-tierra-400 line-through" : "bg-tierra-100 text-tierra-800",
    });
  }
  for (const r of reminders) {
    push(formatDateOnly(r.fecha), {
      label: `🔔 ${r.reminderRule.titulo}`,
      color: "bg-yellow-100 text-yellow-800",
    });
  }

  const days: Date[] = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) days.push(d);

  const today = todayColombia();
  const prevMonth = `${monthIndex === 0 ? year - 1 : year}-${String(monthIndex === 0 ? 12 : monthIndex).padStart(2, "0")}`;
  const nextMonth = `${monthIndex === 11 ? year + 1 : year}-${String(monthIndex === 11 ? 1 : monthIndex + 2).padStart(2, "0")}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-verde-800">
          {MESES[monthIndex]} {year}
        </h1>
        <div className="flex gap-2">
          <Link href={`/calendario?month=${prevMonth}`} className="btn-outline">← Anterior</Link>
          <Link href={`/calendario?month=${formatDateOnly(today).slice(0, 7)}`} className="btn-outline">Hoy</Link>
          <Link href={`/calendario?month=${nextMonth}`} className="btn-outline">Siguiente →</Link>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="grid min-w-[700px] grid-cols-7 gap-1">
          {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
            <div key={d} className="px-1 py-1 text-center text-xs font-semibold text-tierra-500">{d}</div>
          ))}
          {days.map((d) => {
            const key = formatDateOnly(d);
            const items = itemsByDay.get(key) ?? [];
            const inMonth = d.getUTCMonth() === monthIndex;
            const isToday = key === formatDateOnly(today);
            return (
              <div
                key={key}
                className={`min-h-[110px] rounded-lg border p-1.5 text-left align-top ${
                  inMonth ? "border-verde-100 bg-white" : "border-verde-50 bg-verde-50/40"
                } ${isToday ? "ring-2 ring-verde-400" : ""}`}
              >
                <p className={`mb-1 text-xs font-medium ${inMonth ? "text-tierra-700" : "text-tierra-300"}`}>
                  {d.getUTCDate()}
                </p>
                <div className="space-y-0.5">
                  {items.slice(0, 3).map((item, i) => (
                    <p key={i} className={`truncate rounded px-1 py-0.5 text-[10px] ${item.color}`} title={item.label}>
                      {item.label}
                    </p>
                  ))}
                  {items.length > 3 && (
                    <p className="text-[10px] text-tierra-400">+{items.length - 3} más</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
