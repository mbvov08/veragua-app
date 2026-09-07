import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatDateShortEs } from "@/lib/date";
import { createTask, deleteTask } from "@/lib/actions/tasks";
import TaskStatusSelect from "@/components/TaskStatusSelect";
import ConfirmButton from "@/components/ConfirmButton";

export default async function TareasPage({
  searchParams,
}: {
  searchParams: Promise<{ asignadoAId?: string; estado?: string }>;
}) {
  const session = await auth();
  if (!session?.user) return null;
  const params = await searchParams;
  const isAdmin = session.user.role === "ADMIN";

  const users = await prisma.user.findMany({ orderBy: { name: "asc" } });

  const tasks = await prisma.task.findMany({
    where: {
      ...(params.asignadoAId ? { asignadoAId: params.asignadoAId } : {}),
      ...(params.estado ? { estado: params.estado } : {}),
    },
    include: { asignadoA: true, creadoPor: true },
    orderBy: [{ estado: "asc" }, { fechaLimite: "asc" }],
  });

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-verde-800">Tareas / Pendientes</h1>

      {isAdmin && (
        <details className="card" open>
          <summary className="cursor-pointer text-sm font-semibold text-verde-800">Nueva tarea</summary>
          <form action={createTask} className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label">Título</label>
              <input name="titulo" required className="input" />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Descripción (opcional)</label>
              <textarea name="descripcion" className="input" rows={2} />
            </div>
            <div>
              <label className="label">Asignar a</label>
              <select name="asignadoAId" required className="input">
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Fecha límite (opcional)</label>
              <input type="date" name="fechaLimite" className="input" />
            </div>
            <div className="sm:col-span-2">
              <button type="submit" className="btn-primary">Crear tarea</button>
            </div>
          </form>
        </details>
      )}

      <form className="card flex flex-wrap items-end gap-3" method="get">
        <div>
          <label className="label">Asignada a</label>
          <select name="asignadoAId" defaultValue={params.asignadoAId ?? ""} className="input">
            <option value="">Todas</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Estado</label>
          <select name="estado" defaultValue={params.estado ?? ""} className="input">
            <option value="">Todos</option>
            <option value="PENDIENTE">Pendiente</option>
            <option value="EN_PROCESO">En proceso</option>
            <option value="COMPLETADO">Completado</option>
          </select>
        </div>
        <button type="submit" className="btn-primary">Filtrar</button>
      </form>

      <div className="card">
        <ul className="divide-y divide-verde-50">
          {tasks.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="text-sm font-medium text-tierra-800">{t.titulo}</p>
                {t.descripcion && <p className="text-xs text-tierra-500">{t.descripcion}</p>}
                <p className="text-xs text-tierra-400">
                  Asignada a {t.asignadoA.name}
                  {t.fechaLimite && <> · vence {formatDateShortEs(t.fechaLimite)}</>}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <TaskStatusSelect taskId={t.id} estado={t.estado} />
                {isAdmin && (
                  <ConfirmButton
                    action={deleteTask.bind(null, t.id)}
                    confirmMessage="¿Eliminar esta tarea?"
                    className="text-xs text-red-600 hover:underline"
                  >
                    Eliminar
                  </ConfirmButton>
                )}
              </div>
            </li>
          ))}
          {tasks.length === 0 && (
            <p className="py-6 text-center text-sm text-tierra-500">No hay tareas.</p>
          )}
        </ul>
      </div>
    </div>
  );
}
