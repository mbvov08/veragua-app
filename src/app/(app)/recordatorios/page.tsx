import { prisma } from "@/lib/prisma";
import { DIAS_SEMANA, formatDateShortEs, formatDateOnly, todayColombia } from "@/lib/date";
import {
  createReminderRule,
  deleteReminderRule,
  toggleReminderRule,
  createOneOffReminderForDate,
} from "@/lib/actions/reminders";
import ConfirmButton from "@/components/ConfirmButton";

export default async function RecordatoriosPage() {
  const rules = await prisma.reminderRule.findMany({
    where: { esUnico: false },
    orderBy: [{ activo: "desc" }, { diaSemana: "asc" }],
  });

  const eventos = await prisma.reminderRule.findMany({
    where: { esUnico: true },
    include: { instances: true },
    orderBy: { createdAt: "desc" },
  });

  const today = todayColombia();

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-verde-800">Recordatorios</h1>

      <details className="card" open>
        <summary className="cursor-pointer text-sm font-semibold text-verde-800">Nuevo recordatorio semanal</summary>
        <p className="mt-2 text-xs text-tierra-500">
          Se repite cada semana, el mismo día. Aparece en la campana de notificaciones y en el calendario.
        </p>
        <form action={createReminderRule} className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Título</label>
            <input name="titulo" required className="input" placeholder="Montar pedido lácteos Manizales" />
          </div>
          <div>
            <label className="label">Día de la semana</label>
            <select name="diaSemana" required className="input" defaultValue="3">
              {DIAS_SEMANA.map((d, i) => (
                <option key={i} value={i}>{d}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Mensaje (opcional)</label>
            <input name="mensaje" className="input" />
          </div>
          <div className="sm:col-span-2">
            <button type="submit" className="btn-primary">Crear recordatorio</button>
          </div>
        </form>
      </details>

      <details className="card">
        <summary className="cursor-pointer text-sm font-semibold text-verde-800">Nuevo evento / fecha especial</summary>
        <p className="mt-2 text-xs text-tierra-500">
          Para algo puntual que no se repite cada semana (un evento, una fecha límite, un compromiso especial).
        </p>
        <form action={createOneOffReminderForDate} className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Título</label>
            <input name="titulo" required className="input" placeholder="Feria de Amor y Amistad" />
          </div>
          <div>
            <label className="label">Fecha</label>
            <input type="date" name="fecha" required className="input" defaultValue={formatDateOnly(today)} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Mensaje (opcional)</label>
            <input name="mensaje" className="input" />
          </div>
          <div className="sm:col-span-2">
            <button type="submit" className="btn-primary">Crear evento</button>
          </div>
        </form>
      </details>

      <div className="card">
        <h2 className="mb-3 text-sm font-semibold text-verde-800">Recordatorios semanales</h2>
        <ul className="divide-y divide-verde-50">
          {rules.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div>
                <p className={`text-sm font-medium ${r.activo ? "text-tierra-800" : "text-tierra-400 line-through"}`}>
                  {r.titulo} · {DIAS_SEMANA[r.diaSemana]}
                </p>
                {r.mensaje && <p className="text-xs text-tierra-500">{r.mensaje}</p>}
              </div>
              <div className="flex items-center gap-3">
                <ConfirmButton
                  action={toggleReminderRule.bind(null, r.id, !r.activo)}
                  confirmMessage={r.activo ? "¿Pausar este recordatorio?" : "¿Reactivar este recordatorio?"}
                  className="text-xs text-tierra-600 hover:underline"
                >
                  {r.activo ? "Pausar" : "Reactivar"}
                </ConfirmButton>
                <ConfirmButton
                  action={deleteReminderRule.bind(null, r.id)}
                  confirmMessage="¿Eliminar este recordatorio?"
                  className="text-xs text-red-600 hover:underline"
                >
                  Eliminar
                </ConfirmButton>
              </div>
            </li>
          ))}
          {rules.length === 0 && (
            <p className="py-6 text-center text-sm text-tierra-500">No hay recordatorios semanales configurados.</p>
          )}
        </ul>
      </div>

      <div className="card">
        <h2 className="mb-3 text-sm font-semibold text-verde-800">Eventos / fechas especiales</h2>
        <ul className="divide-y divide-verde-50">
          {eventos.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div>
                <p className={`text-sm font-medium ${e.activo ? "text-tierra-800" : "text-tierra-400 line-through"}`}>
                  {e.titulo}
                  {e.instances[0] && <> · {formatDateShortEs(e.instances[0].fecha)}</>}
                </p>
                {e.mensaje && <p className="text-xs text-tierra-500">{e.mensaje}</p>}
              </div>
              <div className="flex items-center gap-3">
                <ConfirmButton
                  action={toggleReminderRule.bind(null, e.id, !e.activo)}
                  confirmMessage={e.activo ? "¿Pausar este evento?" : "¿Reactivar este evento?"}
                  className="text-xs text-tierra-600 hover:underline"
                >
                  {e.activo ? "Pausar" : "Reactivar"}
                </ConfirmButton>
                <ConfirmButton
                  action={deleteReminderRule.bind(null, e.id)}
                  confirmMessage="¿Eliminar este evento?"
                  className="text-xs text-red-600 hover:underline"
                >
                  Eliminar
                </ConfirmButton>
              </div>
            </li>
          ))}
          {eventos.length === 0 && (
            <p className="py-6 text-center text-sm text-tierra-500">No hay eventos especiales configurados.</p>
          )}
        </ul>
      </div>
    </div>
  );
}
