"use client";

import { useMemo, useState } from "react";
import { formatCOP } from "@/lib/finanzas/format";

export type Item = { productoId: string; nombre: string; cantidad: string; precio: string };
type Producto = { id: string; nombre: string; precioDefault: number; categoria: string };

export default function ItemsPicker({
  productos,
  priceFieldName,
  priceLabel = "Precio unitario",
  initialItems = [],
}: {
  productos: Producto[];
  priceFieldName: "precioUnitario" | "costoUnitario";
  priceLabel?: string;
  initialItems?: Item[];
}) {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [query, setQuery] = useState("");

  const categorias = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtrados = q ? productos.filter((p) => p.nombre.toLowerCase().includes(q)) : productos;
    const map = new Map<string, Producto[]>();
    for (const p of filtrados) map.set(p.categoria, [...(map.get(p.categoria) ?? []), p]);
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [productos, query]);

  function agregar(producto: Producto) {
    setItems((prev) => {
      if (prev.some((it) => it.productoId === producto.id)) return prev;
      return [...prev, { productoId: producto.id, nombre: producto.nombre, cantidad: "1", precio: String(producto.precioDefault) }];
    });
    setQuery("");
  }

  function quitar(productoId: string) {
    setItems((prev) => prev.filter((it) => it.productoId !== productoId));
  }

  function cambiar(productoId: string, field: "cantidad" | "precio", value: string) {
    setItems((prev) => prev.map((it) => (it.productoId === productoId ? { ...it, [field]: value } : it)));
  }

  const total = items.reduce((sum, it) => sum + (Number(it.cantidad) || 0) * (Number(it.precio) || 0), 0);

  return (
    <div className="sm:col-span-2 space-y-3">
      <input
        type="hidden"
        name="itemsJson"
        readOnly
        value={JSON.stringify(
          items.map(({ productoId, cantidad, precio }) => ({ productoId, cantidad, [priceFieldName]: precio }))
        )}
      />

      {items.length > 0 && (
        <div className="rounded-lg border border-verde-200 bg-white p-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-tierra-500">
                <th className="pb-1">Producto</th>
                <th className="pb-1">Cantidad</th>
                <th className="pb-1">{priceLabel}</th>
                <th className="pb-1">Subtotal</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.productoId}>
                  <td className="py-1 pr-2">{it.nombre}</td>
                  <td className="py-1 pr-2">
                    <input value={it.cantidad} onChange={(e) => cambiar(it.productoId, "cantidad", e.target.value)} className="input w-20 py-1" />
                  </td>
                  <td className="py-1 pr-2">
                    <input value={it.precio} onChange={(e) => cambiar(it.productoId, "precio", e.target.value)} className="input w-28 py-1" />
                  </td>
                  <td className="py-1 pr-2 text-tierra-700">
                    {formatCOP((Number(it.cantidad) || 0) * (Number(it.precio) || 0))}
                  </td>
                  <td className="py-1">
                    <button type="button" onClick={() => quitar(it.productoId)} className="chip-danger">
                      Quitar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-right text-sm font-semibold text-verde-800">Total: {formatCOP(total)}</p>
        </div>
      )}

      <div className="rounded-lg border border-verde-100 bg-verde-50/40 p-3">
        <label className="label">Buscar producto</label>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Escribe para buscar..."
          className="input mb-2"
        />
        <div className="max-h-72 space-y-2 overflow-y-auto">
          {categorias.map(([categoria, prods]) => (
            <details key={categoria} className="rounded-lg border border-verde-100 bg-white" open={query.length > 0}>
              <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium text-verde-800">
                {categoria} <span className="text-xs font-normal text-tierra-400">({prods.length})</span>
              </summary>
              <div className="flex flex-wrap gap-2 p-3 pt-0">
                {prods.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => agregar(p)}
                    className="rounded-full border border-verde-200 bg-verde-50 px-3 py-1 text-xs text-tierra-700 hover:bg-verde-100"
                  >
                    {p.nombre} — {formatCOP(p.precioDefault)}
                  </button>
                ))}
              </div>
            </details>
          ))}
          {categorias.length === 0 && <p className="text-xs text-tierra-500">Sin resultados.</p>}
        </div>
      </div>
    </div>
  );
}
