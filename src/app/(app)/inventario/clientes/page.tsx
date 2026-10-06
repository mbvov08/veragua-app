import SubmitButton from "@/components/SubmitButton";
import ImportarContactoButton from "@/components/ImportarContactoButton";
import { Icon } from "@/components/icons";
import { prisma } from "@/lib/prisma";
import { crearCliente, editarCliente } from "@/lib/actions/inventario-ventas";

const ZONA_LABEL: Record<string, string> = {
  LOCAL: "Local",
  PEREIRA: "Ruta Pereira",
  MANIZALES: "Ruta Manizales",
};

export default async function ClientesPage() {
  const todosLosClientes = await prisma.cliente.findMany({ orderBy: { nombre: "asc" } });

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-verde-800">Clientes</h1>

      <details className="card">
        <summary className="cursor-pointer text-sm font-semibold text-verde-800">Nuevo cliente</summary>
        <form action={crearCliente} className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Nombre</label>
            <input id="clienteNuevoNombre" name="nombre" required className="input" />
          </div>
          <div>
            <label className="label">Teléfono (opcional)</label>
            <div className="flex items-center gap-2">
              <input id="clienteNuevoTelefono" name="telefono" className="input" />
              <ImportarContactoButton nombreInputId="clienteNuevoNombre" telefonoInputId="clienteNuevoTelefono" />
            </div>
          </div>
          <div>
            <label className="label">Dirección (opcional)</label>
            <input name="direccion" className="input" />
          </div>
          <div>
            <label className="label">Zona</label>
            <select name="zona" className="input" defaultValue="LOCAL">
              <option value="LOCAL">Local</option>
              <option value="PEREIRA">Ruta Pereira</option>
              <option value="MANIZALES">Ruta Manizales</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <SubmitButton>Guardar cliente</SubmitButton>
          </div>
        </form>
      </details>

      <div className="card">
        <h2 className="mb-3 text-sm font-semibold text-verde-800">Todos los clientes ({todosLosClientes.length})</h2>
        {todosLosClientes.length === 0 ? (
          <p className="text-sm text-tierra-500">Todavía no hay clientes registrados.</p>
        ) : (
          <div className="divide-y divide-verde-50">
            {todosLosClientes.map((c) => (
              <details key={c.id} className="group py-1">
                <summary className="flex cursor-pointer list-none items-center gap-3 rounded-lg px-1 py-2 hover:bg-verde-50/60">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-tierra-800">{c.nombre}</p>
                    <p className="text-xs text-tierra-500">
                      {ZONA_LABEL[c.zona] ?? c.zona}
                      {c.telefono ? ` · ${c.telefono}` : ""}
                    </p>
                  </div>
                  {!c.telefono && <span className="badge bg-tierra-100 text-tierra-500">Sin teléfono</span>}
                  <Icon name="chevron-right" className="h-4 w-4 shrink-0 text-tierra-400 transition-transform group-open:rotate-90" />
                </summary>
                <form
                  action={editarCliente.bind(null, c.id)}
                  className="mt-2 grid gap-3 rounded-lg border border-verde-100 bg-verde-50/40 p-3 sm:grid-cols-2"
                >
                  <div>
                    <label className="label">Nombre</label>
                    <input id={`clienteNombre-${c.id}`} name="nombre" required defaultValue={c.nombre} className="input" />
                  </div>
                  <div>
                    <label className="label">Teléfono</label>
                    <div className="flex items-center gap-2">
                      <input id={`clienteTelefono-${c.id}`} name="telefono" defaultValue={c.telefono ?? ""} className="input" />
                      <ImportarContactoButton nombreInputId={`clienteNombre-${c.id}`} telefonoInputId={`clienteTelefono-${c.id}`} />
                    </div>
                  </div>
                  <div>
                    <label className="label">Dirección</label>
                    <input name="direccion" defaultValue={c.direccion} className="input" />
                  </div>
                  <div>
                    <label className="label">Zona</label>
                    <select name="zona" className="input" defaultValue={c.zona}>
                      <option value="LOCAL">Local</option>
                      <option value="PEREIRA">Ruta Pereira</option>
                      <option value="MANIZALES">Ruta Manizales</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <SubmitButton className="btn-secondary">Guardar cambios</SubmitButton>
                  </div>
                </form>
              </details>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
