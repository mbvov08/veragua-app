"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { eliminarProducto } from "@/lib/actions/productos";

type Item = { productoId: string; nombre: string; cantidad: string };
type Producto = { id: string; nombre: string; categoria: string };

export default function OrderItemsPicker({
  productos,
  initialItems = [],
}: {
  productos: Producto[];
  initialItems?: { productoId: string; nombre: string; cantidad: string }[];
}) {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [editando, setEditando] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const categorias = useMemo(() => {
    const map = new Map<string, Producto[]>();
    for (const p of productos) {
      map.set(p.categoria, [...(map.get(p.categoria) ?? []), p]);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [productos]);

  function agregar(productoId: string, nombre: string) {
    setItems((prev) => {
      if (prev.some((it) => it.productoId === productoId)) return prev;
      return [...prev, { productoId, nombre, cantidad: "1" }];
    });
  }

  function quitar(productoId: string) {
    setItems((prev) => prev.filter((it) => it.productoId !== productoId));
  }

  function cambiarCantidad(productoId: string, cantidad: string) {
    setItems((prev) => prev.map((it) => (it.productoId === productoId ? { ...it, cantidad } : it)));
  }

  return (
    <div className="sm:col-span-2 space-y-3">
      <input
        type="hidden"
        name="itemsJson"
        value={JSON.stringify(items.map(({ productoId, cantidad }) => ({ productoId, cantidad })))}
        readOnly
      />

      {items.length > 0 && (
        <div className="rounded-lg border border-verde-200 bg-white p-3">
          <p className="mb-2 text-xs font-semibold text-verde-800">Productos del pedido</p>
          <ul className="space-y-2">
            {items.map((it) => (
              <li key={it.productoId} className="flex items-center gap-2 text-sm">
                <span className="flex-1 text-tierra-800">{it.nombre}</span>
                <input
                  value={it.cantidad}
                  onChange={(e) => cambiarCantidad(it.productoId, e.target.value)}
                  placeholder="cantidad"
                  className="input w-24 py-1 text-xs"
                />
                <button
                  type="button"
                  onClick={() => quitar(it.productoId)}
                  className="text-xs text-red-500 hover:underline"
                >
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-lg border border-verde-100 bg-verde-50/40 p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold text-verde-800">Productos por categoría (clic para agregar)</p>
          <button
            type="button"
            onClick={() => setEditando((v) => !v)}
            className="text-xs text-tierra-600 hover:underline"
          >
            {editando ? "Listo" : "Editar lista"}
          </button>
        </div>

        <div className="space-y-2">
          {categorias.map(([categoria, prods]) => (
            <details key={categoria} className="rounded-lg border border-verde-100 bg-white">
              <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium text-verde-800">
                {categoria} <span className="text-xs font-normal text-tierra-400">({prods.length})</span>
              </summary>
              <div className="flex flex-wrap gap-2 p-3 pt-0">
                {prods.map((p) => (
                  <div key={p.id} className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => agregar(p.id, p.nombre)}
                      className="rounded-full border border-verde-200 bg-verde-50 px-3 py-1 text-xs text-tierra-700 hover:bg-verde-100"
                    >
                      {p.nombre}
                    </button>
                    {editando && (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() =>
                          startTransition(async () => {
                            await eliminarProducto(p.id);
                            router.refresh();
                          })
                        }
                        className="text-xs text-red-500 hover:underline"
                        aria-label={`Eliminar ${p.nombre}`}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </details>
          ))}
          {productos.length === 0 && (
            <p className="text-xs text-tierra-500">Todavía no hay productos en la lista.</p>
          )}
        </div>

        {editando && (
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <input id="nuevoProductoNombre" placeholder="Nombre del producto" className="input text-sm" />
            <input
              id="nuevoProductoCategoria"
              placeholder="Categoría (ej. Gelato)"
              list="categorias-existentes"
              className="input text-sm"
            />
            <datalist id="categorias-existentes">
              {categorias.map(([c]) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <button
              type="button"
              className="btn-secondary text-xs"
              onClick={() => {
                const nombreInput = document.getElementById("nuevoProductoNombre") as HTMLInputElement | null;
                const categoriaInput = document.getElementById("nuevoProductoCategoria") as HTMLInputElement | null;
                const nombre = nombreInput?.value.trim();
                const categoria = categoriaInput?.value.trim();
                if (!nombre) return;
                const fd = new FormData();
                fd.set("nombre", nombre);
                if (categoria) fd.set("categoria", categoria);
                startTransition(async () => {
                  const { crearProducto } = await import("@/lib/actions/productos");
                  await crearProducto(fd);
                  router.refresh();
                });
                if (nombreInput) nombreInput.value = "";
                if (categoriaInput) categoriaInput.value = "";
              }}
            >
              Agregar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
