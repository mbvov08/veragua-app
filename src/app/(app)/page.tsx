import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { todayColombia, formatTimeCo, formatDateLongEs, computeWorkedHours, dayOfWeek } from "@/lib/date";
import ClockWidget from "@/components/ClockWidget";

const ZONA_LABEL: Record<string, string> = {
  LOCAL: "Local",
  PEREIRA: "Ruta Pereira",
  MANIZALES: "Ruta Manizales",
};

const ESTADO_LABEL: Record<string, string> = {
  PENDIENTE: "Pendiente",
  EN_PROCESO: "En proceso",
  COMPLETADO: "Completado",
};

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) return null;
  const isAdmin = session.user.role === "ADMIN";
  const isGalpon = session.user.role === "GALPON";
  const today = todayColombia();

  if (isGalpon) {
    const registroHoy = await prisma.registroGalpon.findUnique({
      where: { userId_fecha: { userId: session.user.id, fecha: today } },
    });
    const tasksPending = await prisma.task.findMany({
      where: { estado: { not: "COMPLETADO" }, asignadoAId: session.user.id },
      orderBy: { fechaLimite: "asc" },
      take: 6,
    });
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-verde-800 capitalize">
            Hola, {(session.user.name ?? session.user.username).split(" ")[0]}
          </h1>
          <p className="text-sm text-tierra-500 capitalize">{formatDateLongEs(today)}</p>
        </div>
        <div className="card">
          <h2 className="mb-2 text-sm font-semibold text-verde-800">Producción de hoy</h2>
          {registroHoy ? (
            <p className="text-sm text-tierra-700">
              Ya registraste {registroHoy.huevosProducidos} huevos ({registroHoy.huevosRotos} rotos).
            </p>
          ) : (
            <p className="text-sm text-tierra-500">Aún no registras la producción de hoy.</p>
          )}
          <Link href="/produccion" className="mt-3 inline-block text-sm text-verde-700 underline">
            Ir a registrar →
          </Link>
        </div>
        <div className="card">
          <h2 className="mb-2 text-sm font-semibold text-verde-800">Tareas pendientes</h2>
          {tasksPending.length === 0 ? (
            <p className="text-sm text-tierra-500">No hay tareas pendientes.</p>
          ) : (
            <ul className="divide-y divide-verde-50">
              {tasksPending.map((t) => (
                <li key={t.id} className="py-2 text-sm text-tierra-800">{t.titulo}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }

  const [ordersToday, tasksPending, myEntryToday] = await Promise.all([
    prisma.order.findMany({
      where: {
        OR: [{ fechaEntrega: today }, { entregado: false, fechaEntrega: { lt: today } }],
      },
      orderBy: [{ fechaEntrega: "asc" }, { zona: "asc" }],
    }),
    prisma.task.findMany({
      where: {
        estado: { not: "COMPLETADO" },
        OR: [{ fechaLimite: { lte: today } }, { fechaLimite: null }],
        ...(isAdmin ? {} : { asignadoAId: session.user.id }),
      },
      include: { asignadoA: true },
      orderBy: { fechaLimite: "asc" },
      take: 6,
    }),
    prisma.timeEntry.findUnique({
      where: { userId_workDate: { userId: session.user.id, workDate: today } },
    }),
  ]);

  let clockStatus: "none" | "in" | "done" = "none";
  let clockInLabel, clockOutLabel, workedLabel;
  if (myEntryToday) {
    clockInLabel = formatTimeCo(myEntryToday.clockIn);
    if (myEntryToday.clockOut) {
      clockStatus = "done";
      clockOutLabel = formatTimeCo(myEntryToday.clockOut);
      const dow = dayOfWeek(today);
      const hours = computeWorkedHours(myEntryToday.clockIn, myEntryToday.clockOut, dow);
      workedLabel = `${hours.toFixed(2)} h`;
    } else {
      clockStatus = "in";
    }
  }

  let empleadaStatusToday: { name: string; label: string } | null = null;
  if (isAdmin) {
    const empleadaEntry = await prisma.timeEntry.findFirst({
      where: { workDate: today, user: { role: "EMPLEADA" } },
      include: { user: true },
    });
    if (empleadaEntry) {
      empleadaStatusToday = {
        name: empleadaEntry.user.name,
        label: empleadaEntry.clockOut
          ? `Entrada ${formatTimeCo(empleadaEntry.clockIn)} · Salida ${formatTimeCo(empleadaEntry.clockOut)}`
          : `Entrada ${formatTimeCo(empleadaEntry.clockIn)} · aún trabajando`,
      };
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-verde-800 capitalize">
          Hola, {(session.user.name ?? session.user.username).split(" ")[0]}
        </h1>
        <p className="text-sm text-tierra-500 capitalize">{formatDateLongEs(today)}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {!isAdmin && (
          <ClockWidget
            status={clockStatus}
            clockInLabel={clockInLabel}
            clockOutLabel={clockOutLabel}
            workedLabel={workedLabel}
          />
        )}

        {isAdmin && (
          <div className="card">
            <h2 className="mb-2 text-sm font-semibold text-verde-800">Personal hoy</h2>
            {empleadaStatusToday ? (
              <p className="text-sm text-tierra-700">
                <span className="font-medium">{empleadaStatusToday.name}:</span>{" "}
                {empleadaStatusToday.label}
              </p>
            ) : (
              <p className="text-sm text-tierra-500">Aún no hay registro de entrada hoy.</p>
            )}
            <Link href="/personal/historial" className="mt-3 inline-block text-sm text-verde-700 underline">
              Ver historial completo →
            </Link>
          </div>
        )}

        <div className="card">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-verde-800">Entregas de hoy y atrasadas</h2>
            <Link href="/pedidos" className="text-xs text-verde-700 underline">Ver todos</Link>
          </div>
          {ordersToday.length === 0 ? (
            <p className="text-sm text-tierra-500">No hay pedidos programados para hoy.</p>
          ) : (
            <ul className="space-y-2">
              {ordersToday.map((o) => (
                <li key={o.id} className="flex items-center justify-between text-sm">
                  <span className={o.entregado ? "line-through text-tierra-400" : "text-tierra-800"}>
                    {o.cliente} · {ZONA_LABEL[o.zona]}
                  </span>
                  {o.entregado ? (
                    <span className="badge bg-verde-100 text-verde-700">Entregado</span>
                  ) : (
                    o.fechaEntrega < today && (
                      <span className="badge bg-red-100 text-red-700">⚠️ Atrasado</span>
                    )
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="card">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-verde-800">Tareas pendientes</h2>
          <Link href="/tareas" className="text-xs text-verde-700 underline">Ver todas</Link>
        </div>
        {tasksPending.length === 0 ? (
          <p className="text-sm text-tierra-500">No hay tareas pendientes o vencidas.</p>
        ) : (
          <ul className="divide-y divide-verde-50">
            {tasksPending.map((t) => (
              <li key={t.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <p className="font-medium text-tierra-800">{t.titulo}</p>
                  <p className="text-xs text-tierra-500">Asignada a {t.asignadoA.name}</p>
                </div>
                <span className="badge bg-tierra-100 text-tierra-700">{ESTADO_LABEL[t.estado]}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
