import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatDateShortEs } from "@/lib/date";
import { createTask, deleteTask } from "@/lib/actions/tasks";
import TaskStatusSelect from "@/components/TaskStatusSelect";
import ConfirmButton from "@/components/ConfirmButton";

function progreso(fases: { estado: string }[]) {
  if (fases.length === 0) return 0;
  const done = fases.filter((f) => f.estado === "COMPLETADO").length;
  return Math.round((done / fases.length) * 100);
}

export default async function TareasPage({
  searchParams,
}: {
  searchParams: Promise<{ asignadoAId?: string; estado?: string }>;
}) {
  const session = await auth();
  if (!session?.user) return null;
  const params = await searchParams;
  const isAdmin = session.user.role === "ADMIN";

  const allUsers = await prisma.user.findMany({ orderBy: { name: "asc" } });
  // Cada quien ve solo sus propias tareas; la administradora ve todas.
  const usersForFilter = isAdmin ? allUsers : allUsers.filter((u) => u.id === session.user.id);

  const proyectosDisponibles = await prisma.task.findMany({
    where: { esProyecto: true },
    orderBy: { titulo: "asc" },
  });

  const estadoParam = params.estado ?? "";
  const estadoFilter =
    estadoParam === "" ? { estado: { not: "COMPLETADO" } } : estadoParam === "TODOS" ? {} : { estado: estadoParam };

  const tasks = await prisma.task.findMany({
    where: {
      proyectoId: null,
      ...(isAdmin
        ? params.asignadoAId
          ? { asignadoAId: params.asignadoAId }
          : {}
        : { asignadoAId: session.user.id }),
      ...estadoFilter,
    },
    include: {
      asignadoA: true,
      creadoPor: true,
      fases: { include: { asignadoA: true }, orderBy: { createdAt: "asc" } },
    },
    orderBy: [{ estado: "asc" }, { fechaLimite: "asc" }],
  });

  const misFasesDeOtrosProyectos = isAdmin
    ? []
    : await prisma.task.findMany({
        where: {
          proyectoId: { not: null },
          asignadoAId: session.user.id,
          ...estadoFilter,
          NOT: { proyecto: { asignadoAId: session.user.id } },
        },
        include: { proyecto: true, asignadoA: true },
        orderBy: { createdAt: "asc" },
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
                {allUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Fecha tentativa (opcional)</label>
              <input type="date" name="fechaTentativa" className="input" />
              <p className="mt-1 text-xs text-tierra-400">Cuándo debería estar lista, idealmente.</p>
            </div>
            <div>
              <label className="label">Fecha límite (opcional)</label>
              <input type="date" name="fechaLimite" className="input" />
              <p className="mt-1 text-xs text-tierra-400">No se puede pasar de esta fecha.</p>
            </div>
            <div>
              <label className="label">Pertenece a un proyecto (opcional)</label>
              <select name="proyectoId" className="input" defaultValue="">
                <option value="">Ninguno</option>
                {proyectosDisponibles.map((p) => (
                  <option key={p.id} value={p.id}>{p.titulo}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2 flex items-center gap-2">
              <input type="checkbox" name="esProyecto" id="esProyecto" className="h-4 w-4" />
              <label htmlFor="esProyecto" className="text-sm text-tierra-700">
                Es un proyecto con varias fases (podrás agregar tareas dentro de este)
              </label>
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
            {usersForFilter.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Estado</label>
          <select name="estado" defaultValue={params.estado ?? ""} className="input">
            <option value="">Activas (sin completadas)</option>
            <option value="PENDIENTE">Pendiente</option>
            <option value="EN_PROCESO">En proceso</option>
            <option value="COMPLETADO">Completado (histórico)</option>
            <option value="TODOS">Todas</option>
          </select>
        </div>
        <button type="submit" className="btn-primary">Filtrar</button>
      </form>

      <div className="card">
        <ul className="divide-y divide-verde-50">
          {tasks.map((t) => (
            <li key={t.id} className="py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-tierra-800">
                    {t.esProyecto && <span className="badge mr-1 bg-dorado-100 text-tierra-700">Proyecto</span>}
                    {t.titulo}
                  </p>
                  {t.descripcion && <p className="text-xs text-tierra-500">{t.descripcion}</p>}
                  <p className="text-xs text-tierra-400">
                    Asignada a {t.asignadoA.name}
                    {t.fechaTentativa && <> · meta {formatDateShortEs(t.fechaTentativa)}</>}
                    {t.fechaLimite && <> · límite {formatDateShortEs(t.fechaLimite)}</>}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <TaskStatusSelect taskId={t.id} estado={t.estado} />
                  {isAdmin && (
                    <ConfirmButton
                      action={deleteTask.bind(null, t.id)}
                      confirmMessage={
                        t.fases.length > 0
                          ? "¿Eliminar este proyecto y todas sus fases?"
                          : "¿Eliminar esta tarea?"
                      }
                      className="text-xs text-red-600 hover:underline"
                    >
                      Eliminar
                    </ConfirmButton>
                  )}
                </div>
              </div>

              {t.esProyecto && (
                <div className="mt-3 rounded-lg border border-verde-100 bg-verde-50/40 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold text-verde-800">
                      Progreso: {progreso(t.fases)}% ({t.fases.filter((f) => f.estado === "COMPLETADO").length}/{t.fases.length} fases)
                    </p>
                  </div>
                  <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-verde-100">
                    <div
                      className="h-full bg-verde-600"
                      style={{ width: `${progreso(t.fases)}%` }}
                    />
                  </div>
                  <ul className="space-y-2">
                    {t.fases.map((f) => (
                      <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <div>
                          <p className="text-tierra-800">{f.titulo}</p>
                          <p className="text-xs text-tierra-400">
                            {f.asignadoA.name}
                            {f.fechaLimite && <> · límite {formatDateShortEs(f.fechaLimite)}</>}
                          </p>
                        </div>
                        <TaskStatusSelect taskId={f.id} estado={f.estado} />
                      </li>
                    ))}
                    {t.fases.length === 0 && (
                      <p className="text-xs text-tierra-500">
                        Todavía no tiene fases. Crea una tarea nueva y selecciona este proyecto en &quot;Pertenece a un proyecto&quot;.
                      </p>
                    )}
                  </ul>
                </div>
              )}
            </li>
          ))}
          {tasks.length === 0 && (
            <p className="py-6 text-center text-sm text-tierra-500">No hay tareas.</p>
          )}
        </ul>
      </div>

      {misFasesDeOtrosProyectos.length > 0 && (
        <div className="card">
          <h2 className="mb-3 text-sm font-semibold text-verde-800">Fases asignadas a ti en otros proyectos</h2>
          <ul className="divide-y divide-verde-50">
            {misFasesDeOtrosProyectos.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <div>
                  <p className="text-tierra-800">{f.titulo}</p>
                  <p className="text-xs text-tierra-400">
                    Proyecto: {f.proyecto?.titulo}
                    {f.fechaLimite && <> · límite {formatDateShortEs(f.fechaLimite)}</>}
                  </p>
                </div>
                <TaskStatusSelect taskId={f.id} estado={f.estado} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
