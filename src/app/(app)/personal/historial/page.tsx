import { prisma } from "@/lib/prisma";
import {
  addDays,
  computeWorkedHours,
  dateOnlyToUTC,
  dayOfWeek,
  formatDateOnly,
  formatDateShortEs,
  formatTimeCo,
  todayColombia,
} from "@/lib/date";
import { adminSetTimeEntry, adminDeleteTimeEntry } from "@/lib/actions/personal";
import ConfirmButton from "@/components/ConfirmButton";

const MOTIVO_LABEL: Record<string, string> = {
  CARGA_TRABAJO: "Cantidad de trabajo",
  INGRESO_TARDE_COMPENSO: "Ingresó más tarde y compensó",
  ALMUERZO_EXTENDIDO: "Almuerzo extendido",
  COMPROMISO_PERSONAL: "Compromiso personal",
  OTRO: "Otro motivo",
};

export default async function HistorialPage({
  searchParams,
}: {
  searchParams: Promise<{ userId?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const today = todayColombia();
  const from = params.from ? dateOnlyToUTC(params.from) : addDays(today, -30);
  const to = params.to ? dateOnlyToUTC(params.to) : today;

  const [users, settings] = await Promise.all([
    prisma.user.findMany({ orderBy: { name: "asc" } }),
    prisma.payrollSettings.findUnique({ where: { id: "singleton" } }),
  ]);
  const horasSemanaLegal = settings?.horasSemanaLegal ?? 42;

  const entries = await prisma.timeEntry.findMany({
    where: {
      workDate: { gte: from, lte: to },
      ...(params.userId ? { userId: params.userId } : {}),
    },
    include: { user: true },
    orderBy: [{ workDate: "desc" }],
  });

  const weekTotals = new Map<string, number>();
  for (const e of entries) {
    if (!e.clockOut) continue;
    const dow = dayOfWeek(e.workDate);
    const mondayOffset = dow === 0 ? -6 : 1 - dow;
    const weekStart = addDays(e.workDate, mondayOffset);
    const key = `${e.userId}-${weekStart.toISOString()}`;
    weekTotals.set(key, (weekTotals.get(key) ?? 0) + computeWorkedHours(e.clockIn, e.clockOut, dow));
  }

  const rows = entries.map((e) => {
    const dow = dayOfWeek(e.workDate);
    const worked = e.clockOut ? computeWorkedHours(e.clockIn, e.clockOut, dow) : 0;
    const mondayOffset = dow === 0 ? -6 : 1 - dow;
    const weekStart = addDays(e.workDate, mondayOffset);
    const weekTotal = weekTotals.get(`${e.userId}-${weekStart.toISOString()}`) ?? 0;
    const isExtraWeek = weekTotal > horasSemanaLegal;
    return { e, worked, isExtraWeek };
  });
  const totalHoras = rows.reduce((sum, r) => sum + r.worked, 0);
  const totalExtra = [...weekTotals.values()].reduce(
    (sum, total) => sum + (total > horasSemanaLegal ? total - horasSemanaLegal : 0),
    0
  );

  const exportQs = new URLSearchParams({
    from: formatDateOnly(from),
    to: formatDateOnly(to),
    ...(params.userId ? { userId: params.userId } : {}),
  }).toString();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold text-verde-800">Historial de personal</h1>
        <a href={`/api/personal/export?${exportQs}`} className="btn-secondary">
          ⬇ Exportar a Excel
        </a>
      </div>

      <form className="card grid gap-3 sm:grid-cols-4" method="get">
        <div>
          <label className="label">Empleado(a)</label>
          <select name="userId" defaultValue={params.userId ?? ""} className="input">
            <option value="">Todos</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
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
        <div className="flex items-end">
          <button type="submit" className="btn-primary w-full">Filtrar</button>
        </div>
      </form>

      <details className="card">
        <summary className="cursor-pointer text-sm font-semibold text-verde-800">
          Corregir o agregar un registro (si a alguien se le olvidó marcar)
        </summary>
        <form action={adminSetTimeEntry} className="mt-4 grid gap-3 sm:grid-cols-4">
          <div>
            <label className="label">Empleado(a)</label>
            <select name="userId" required className="input">
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Fecha</label>
            <input type="date" name="fecha" required className="input" defaultValue={formatDateOnly(today)} />
          </div>
          <div>
            <label className="label">Hora entrada</label>
            <input type="time" name="horaEntrada" required className="input" />
          </div>
          <div>
            <label className="label">Hora salida (opcional)</label>
            <input type="time" name="horaSalida" className="input" />
          </div>
          <div className="sm:col-span-4">
            <button type="submit" className="btn-primary">Guardar</button>
          </div>
        </form>
        <p className="mt-2 text-xs text-tierra-400">
          Si ya existe un registro para esa persona y fecha, se reemplaza con estos valores.
        </p>
      </details>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card">
          <p className="text-xs text-tierra-500">Horas totales en el rango</p>
          <p className="text-2xl font-semibold text-verde-800">{totalHoras.toFixed(2)} h</p>
        </div>
        <div className="card">
          <p className="text-xs text-tierra-500">Horas extra (sobre {horasSemanaLegal}h/semana)</p>
          <p className="text-2xl font-semibold text-tierra-700">{totalExtra.toFixed(2)} h</p>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-verde-100 text-left text-xs text-tierra-500">
              <th className="py-2 pr-2">Fecha</th>
              <th className="py-2 pr-2">Empleado(a)</th>
              <th className="py-2 pr-2">Entrada</th>
              <th className="py-2 pr-2">Salida</th>
              <th className="py-2 pr-2">Horas</th>
              <th className="py-2 pr-2">Extra semana</th>
              <th className="py-2 pr-2">Salida tardía</th>
              <th className="py-2 pr-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ e, worked, isExtraWeek }) => (
              <tr key={e.id} className="border-b border-verde-50">
                <td className="py-2 pr-2 capitalize">{formatDateShortEs(e.workDate)}</td>
                <td className="py-2 pr-2">{e.user.name}</td>
                <td className="py-2 pr-2">{formatTimeCo(e.clockIn)}</td>
                <td className="py-2 pr-2">{e.clockOut ? formatTimeCo(e.clockOut) : "—"}</td>
                <td className="py-2 pr-2">{e.clockOut ? worked.toFixed(2) : "—"}</td>
                <td className="py-2 pr-2">{isExtraWeek ? "Sí" : ""}</td>
                <td className="py-2 pr-2 max-w-xs">
                  {e.justificacionSalida && (
                    <>
                      <span className="badge bg-tierra-100 text-tierra-700">
                        {MOTIVO_LABEL[e.motivoSalidaTardia ?? ""] ?? e.motivoSalidaTardia}
                      </span>{" "}
                      <span className={`badge ${e.esJustificable ? "bg-verde-100 text-verde-700" : "bg-red-50 text-red-600"}`}>
                        {e.esJustificable ? "Justificable" : "No justificable"}
                      </span>
                      <p className="mt-0.5 text-xs text-tierra-500">{e.justificacionSalida}</p>
                    </>
                  )}
                </td>
                <td className="py-2 pr-2">
                  <ConfirmButton
                    action={adminDeleteTimeEntry.bind(null, e.id)}
                    confirmMessage="¿Eliminar este registro de horario?"
                    className="text-xs text-red-600 hover:underline"
                  >
                    Eliminar
                  </ConfirmButton>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={8} className="py-6 text-center text-tierra-500">Sin registros en este rango.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
