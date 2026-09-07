import { prisma } from "@/lib/prisma";
import { DIAS_SEMANA } from "@/lib/date";
import { createReminderRule, deleteReminderRule, toggleReminderRule } from "@/lib/actions/reminders";
import ConfirmButton from "@/components/ConfirmButton";

export default async function RecordatoriosPage() {
  const rules = await prisma.reminderRule.findMany({
    orderBy: [{ activo: "desc" }, { diaSemana: "asc" }],
    include: { creadoPor: true },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-verde-800">Recordatorios recurrentes</h1>
      <p className="text-sm text-tierra-500">
        Aparecerán en la campana de notificaciones y en el calendario cada semana, el día que elijas.
      </p>

      <details className="card" open>
        <summary className="cursor-pointer text-sm font-semibold text-verde-800">Nuevo recordatorio</summary>
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

      <div className="card">
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
            <p className="py-6 text-center text-sm text-tierra-500">No hay recordatorios configurados.</p>
          )}
        </ul>
      </div>
    </div>
  );
}
