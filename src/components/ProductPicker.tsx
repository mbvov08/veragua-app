"use client";

import { useState, useTransition } from "react";
import { eliminarProducto } from "@/lib/actions/productos";

export default function ProductPicker({
  productos,
}: {
  productos: { id: string; nombre: string }[];
}) {
  const [editando, setEditando] = useState(false);
  const [isPending, startTransition] = useTransition();

  function agregarANotas(nombre: string) {
    const input = document.getElementById("notas") as HTMLInputElement | null;
    if (!input) return;
    input.value = input.value ? `${input.value}, ${nombre}` : nombre;
    input.focus();
  }

  return (
    <div className="sm:col-span-2 rounded-lg border border-verde-100 bg-verde-50/40 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold text-verde-800">Productos (clic para agregar a notas)</p>
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
              onClick={() => agregarANotas(p.nombre)}
              className="rounded-full border border-verde-200 bg-white px-3 py-1 text-xs text-tierra-700 hover:bg-verde-100"
            >
              {p.nombre}
            </button>
            {editando && (
              <button
                type="button"
                disabled={isPending}
                onClick={() => startTransition(() => eliminarProducto(p.id))}
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
              });
              if (input) input.value = "";
            }}
          >
            Agregar
          </button>
        </div>
      )}
    </div>
  );
}
