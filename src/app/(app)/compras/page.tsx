import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatDateShortEs } from "@/lib/date";
import { crearItemCompra, eliminarItemCompra } from "@/lib/actions/compras";
import CompradoToggle from "@/components/CompradoToggle";
import ConfirmButton from "@/components/ConfirmButton";

function ListaCategoria({
  titulo,
  items,
  isAdmin,
}: {
  titulo: string;
  items: {
    id: string;
    item: string;
    cantidad: string | null;
    comprado: boolean;
    createdAt: Date;
    creadoPor: { name: string };
  }[];
  isAdmin: boolean;
}) {
  const pendientes = items.filter((i) => !i.comprado);
  const comprados = items.filter((i) => i.comprado);
  return (
    <div className="card">
      <h2 className="mb-3 text-sm font-semibold text-verde-800">{titulo}</h2>
      <ul className="divide-y divide-verde-50">
        {[...pendientes, ...comprados].map((i) => (
          <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <div>
              <p className={`text-sm ${i.comprado ? "text-tierra-400 line-through" : "text-tierra-800"}`}>
                {i.item} {i.cantidad && <span className="text-tierra-500">({i.cantidad})</span>}
              </p>
              <p className="text-xs text-tierra-400">
                {i.creadoPor.name} · {formatDateShortEs(i.createdAt)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <CompradoToggle id={i.id} comprado={i.comprado} />
              {isAdmin && (
                <ConfirmButton
                  action={eliminarItemCompra.bind(null, i.id)}
                  confirmMessage="¿Eliminar este ítem?"
                  className="text-xs text-red-600 hover:underline"
                >
                  Eliminar
                </ConfirmButton>
              )}
            </div>
          </li>
        ))}
        {items.length === 0 && (
          <p className="py-6 text-center text-sm text-tierra-500">Nada pendiente por comprar.</p>
        )}
      </ul>
    </div>
  );
}

export default async function ComprasPage() {
  const session = await auth();
  if (!session?.user) return null;
  const role = session.user.role;
  const isAdmin = role === "ADMIN";

  const categoriasVisibles =
    role === "GALPON" ? ["GALPON"] : role === "EMPLEADA" ? ["LOCAL"] : ["GALPON", "LOCAL"];

  const items = await prisma.listaCompras.findMany({
    where: { categoria: { in: categoriasVisibles } },
    include: { creadoPor: true },
    orderBy: { createdAt: "desc" },
  });

  const itemsGalpon = items.filter((i) => i.categoria === "GALPON");
  const itemsLocal = items.filter((i) => i.categoria === "LOCAL");

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-verde-800">Lista de compras</h1>
      <p className="text-sm text-tierra-500">
        {isAdmin
          ? "Ves lo pendiente del galpón y del local."
          : "Solo ves y agregas lo de tu área."}
      </p>

      <details className="card" open>
        <summary className="cursor-pointer text-sm font-semibold text-verde-800">Agregar algo a la lista</summary>
        <form action={crearItemCompra} className="mt-4 grid gap-3 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <label className="label">¿Qué hace falta?</label>
            <input name="item" required className="input" placeholder="Concentrado para gallinas" />
          </div>
          <div>
            <label className="label">Cantidad (opcional)</label>
            <input name="cantidad" className="input" placeholder="2 bultos" />
          </div>
          {isAdmin ? (
            <div>
              <label className="label">Para</label>
              <select name="categoria" className="input" defaultValue="LOCAL">
                <option value="LOCAL">Local</option>
                <option value="GALPON">Galpón</option>
              </select>
            </div>
          ) : (
            <div className="flex items-end text-xs text-tierra-400">
              Se agregará a {role === "GALPON" ? "Galpón" : "Local"}
            </div>
          )}
          <div className="sm:col-span-4">
            <button type="submit" className="btn-primary">Agregar</button>
          </div>
        </form>
      </details>

      {(role === "GALPON" || isAdmin) && (
        <ListaCategoria titulo="Galpón" items={itemsGalpon} isAdmin={isAdmin} />
      )}
      {(role === "EMPLEADA" || isAdmin) && (
        <ListaCategoria titulo="Local" items={itemsLocal} isAdmin={isAdmin} />
      )}
    </div>
  );
}
