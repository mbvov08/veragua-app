import { prisma } from "@/lib/prisma";
import { formatDateShortEs } from "@/lib/date";
import { createUser, toggleUserActive, resetUserPassword } from "@/lib/actions/users";
import ConfirmButton from "@/components/ConfirmButton";

const ROL_LABEL: Record<string, string> = {
  ADMIN: "Administradora",
  EMPLEADA: "Empleada (local)",
  GALPON: "Encargado(a) de galpón",
};

export default async function UsuariosPage() {
  const users = await prisma.user.findMany({ orderBy: [{ activo: "desc" }, { createdAt: "asc" }] });

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-verde-800">Usuarios</h1>
      <p className="text-sm text-tierra-500">
        Crea una cuenta cuando llegue una persona nueva y desactívala (en vez de borrarla) cuando alguien
        se retire, así no se pierde su historial.
      </p>

      <details className="card" open>
        <summary className="cursor-pointer text-sm font-semibold text-verde-800">Nuevo usuario</summary>
        <form action={createUser} className="mt-4 grid gap-3 sm:grid-cols-4">
          <div>
            <label className="label">Nombre completo</label>
            <input name="name" required className="input" />
          </div>
          <div>
            <label className="label">Usuario (para iniciar sesión)</label>
            <input name="username" required className="input" autoCapitalize="none" />
          </div>
          <div>
            <label className="label">Contraseña</label>
            <input name="password" type="text" required minLength={6} className="input" />
          </div>
          <div>
            <label className="label">Rol</label>
            <select name="role" className="input" defaultValue="EMPLEADA">
              <option value="EMPLEADA">Empleada (local)</option>
              <option value="GALPON">Encargado(a) de galpón</option>
              <option value="ADMIN">Administradora</option>
            </select>
          </div>
          <div className="sm:col-span-4">
            <button type="submit" className="btn-primary">Crear usuario</button>
          </div>
        </form>
      </details>

      <div className="card">
        <h2 className="mb-3 text-sm font-semibold text-verde-800">Usuarios existentes</h2>
        <ul className="divide-y divide-verde-50">
          {users.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className={`text-sm font-medium ${u.activo ? "text-tierra-800" : "text-tierra-400 line-through"}`}>
                  {u.name} <span className="text-xs text-tierra-400">@{u.username}</span>
                </p>
                <p className="text-xs text-tierra-500">
                  {ROL_LABEL[u.role] ?? u.role} · desde {formatDateShortEs(u.createdAt)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <form action={resetUserPassword} className="flex items-center gap-2">
                  <input type="hidden" name="userId" value={u.id} />
                  <input
                    type="text"
                    name="password"
                    placeholder="Nueva contraseña"
                    minLength={6}
                    className="input w-40 py-1 text-xs"
                  />
                  <button type="submit" className="text-xs text-verde-700 hover:underline">
                    Cambiar clave
                  </button>
                </form>
                <ConfirmButton
                  action={toggleUserActive.bind(null, u.id, !u.activo)}
                  confirmMessage={u.activo ? "¿Desactivar este usuario? No podrá iniciar sesión." : "¿Reactivar este usuario?"}
                  className="text-xs text-tierra-600 hover:underline"
                >
                  {u.activo ? "Desactivar" : "Reactivar"}
                </ConfirmButton>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
