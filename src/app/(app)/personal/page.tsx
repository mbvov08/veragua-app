import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  addDays,
  computeWorkedHours,
  dayOfWeek,
  formatDateShortEs,
  formatTimeCo,
  todayColombia,
} from "@/lib/date";
import ClockWidget from "@/components/ClockWidget";

export default async function PersonalPage() {
  const session = await auth();
  if (!session?.user) return null;

  if (session.user.role === "ADMIN") {
    return (
      <div className="card">
        <h1 className="mb-2 text-lg font-semibold text-verde-800">Control de personal</h1>
        <p className="text-sm text-tierra-600">
          Esta sección es para que la empleada registre su entrada y salida diaria.
        </p>
        <Link href="/personal/historial" className="btn-primary mt-4 inline-flex">
          Ver historial completo y exportar
        </Link>
      </div>
    );
  }

  const today = todayColombia();
  const since = addDays(today, -20);

  const [myEntryToday, settings, recentEntries] = await Promise.all([
    prisma.timeEntry.findUnique({
      where: { userId_workDate: { userId: session.user.id, workDate: today } },
    }),
    prisma.payrollSettings.findUnique({ where: { id: "singleton" } }),
    prisma.timeEntry.findMany({
      where: { userId: session.user.id, workDate: { gte: since, lte: today } },
      orderBy: { workDate: "desc" },
    }),
  ]);

  let clockStatus: "none" | "in" | "done" = "none";
  let clockInLabel, clockOutLabel, workedLabel;
  if (myEntryToday) {
    clockInLabel = formatTimeCo(myEntryToday.clockIn);
    if (myEntryToday.clockOut) {
      clockStatus = "done";
      clockOutLabel = formatTimeCo(myEntryToday.clockOut);
      workedLabel = `${computeWorkedHours(myEntryToday.clockIn, myEntryToday.clockOut, dayOfWeek(today)).toFixed(2)} h`;
    } else {
      clockStatus = "in";
    }
  }

  const horasSemanaLegal = settings?.horasSemanaLegal ?? 42;

  // Agrupar por semana para mostrar el total y si hubo horas extra.
  const weekTotals = new Map<string, number>();
  for (const e of recentEntries) {
    if (!e.clockOut) continue;
    const dow = dayOfWeek(e.workDate);
    const mondayOffset = dow === 0 ? -6 : 1 - dow;
    const weekStart = addDays(e.workDate, mondayOffset);
    const key = weekStart.toISOString();
    const worked = computeWorkedHours(e.clockIn, e.clockOut, dow);
    weekTotals.set(key, (weekTotals.get(key) ?? 0) + worked);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-verde-800">Mi control de horario</h1>

      <ClockWidget
        status={clockStatus}
        clockInLabel={clockInLabel}
        clockOutLabel={clockOutLabel}
        workedLabel={workedLabel}
      />

      <div className="card">
        <h2 className="mb-3 text-sm font-semibold text-verde-800">Últimos registros</h2>
        {recentEntries.length === 0 ? (
          <p className="text-sm text-tierra-500">Aún no tienes registros.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-verde-100 text-left text-xs text-tierra-500">
                  <th className="py-2 pr-2">Fecha</th>
                  <th className="py-2 pr-2">Entrada</th>
                  <th className="py-2 pr-2">Salida</th>
                  <th className="py-2 pr-2">Horas</th>
                </tr>
              </thead>
              <tbody>
                {recentEntries.map((e) => {
                  const dow = dayOfWeek(e.workDate);
                  const worked = e.clockOut ? computeWorkedHours(e.clockIn, e.clockOut, dow) : null;
                  const mondayOffset = dow === 0 ? -6 : 1 - dow;
                  const weekStart = addDays(e.workDate, mondayOffset);
                  const weekTotal = weekTotals.get(weekStart.toISOString()) ?? 0;
                  const isExtra = e.clockOut && weekTotal > horasSemanaLegal;
                  return (
                    <tr key={e.id} className="border-b border-verde-50">
                      <td className="py-2 pr-2 capitalize">{formatDateShortEs(e.workDate)}</td>
                      <td className="py-2 pr-2">{formatTimeCo(e.clockIn)}</td>
                      <td className="py-2 pr-2">{e.clockOut ? formatTimeCo(e.clockOut) : "—"}</td>
                      <td className="py-2 pr-2">
                        {worked !== null ? worked.toFixed(2) : "—"}
                        {isExtra && (
                          <span className="badge ml-2 bg-tierra-100 text-tierra-700">semana con extra</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-tierra-500">
          Jornada legal semanal vigente: {horasSemanaLegal} horas (Ley 2101). Se marca &quot;semana con extra&quot;
          cuando el total de esa semana supera ese límite.
        </p>
      </div>
    </div>
  );
}
