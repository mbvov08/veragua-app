"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { eliminarProducto } from "@/lib/actions/productos";

type Item = { productoId: string; nombre: string; cantidad: string };

export default function OrderItemsPicker({
  productos,
  initialItems = [],
}: {
  productos: { id: string; nombre: string }[];
  initialItems?: { productoId: string; nombre: string; cantidad: string }[];
}) {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [editando, setEditando] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

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
          <p className="text-xs font-semibold text-verde-800">Clic para agregar producto al pedido</p>
          <button
            type="button"
            onClick={() => setEditando((v) => !v)}
            className="text-xs text-tierra-600 hover:underline"
          >
            {editando ? "Listo" : "Editar lista"}
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {productos.map((p) => (
            <div key={p.id} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => agregar(p.id, p.nombre)}
                className="rounded-full border border-verde-200 bg-white px-3 py-1 text-xs text-tierra-700 hover:bg-verde-100"
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
          {productos.length === 0 && (
            <p className="text-xs text-tierra-500">Todavía no hay productos en la lista.</p>
          )}
        </div>

        {editando && (
          <div className="mt-3 flex gap-2">
            <input
              id="nuevoProductoNombre"
              placeholder="Nombre del producto"
              className="input flex-1 text-sm"
            />
            <button
              type="button"
              className="btn-secondary text-xs"
              onClick={() => {
                const input = document.getElementById("nuevoProductoNombre") as HTMLInputElement | null;
                const nombre = input?.value.trim();
                if (!nombre) return;
                const fd = new FormData();
                fd.set("nombre", nombre);
                startTransition(async () => {
                  const { crearProducto } = await import("@/lib/actions/productos");
                  await crearProducto(fd);
                  router.refresh();
                });
                if (input) input.value = "";
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
