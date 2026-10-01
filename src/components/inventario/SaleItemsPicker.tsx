"use client";

import { useState } from "react";
import { formatCOP } from "@/lib/finanzas/format";

type Item = { productoId: string; nombre: string; cantidad: string; precio: string };
type Producto = { id: string; nombre: string; precioDefault: number };

export default function ItemsPicker({
  productos,
  priceFieldName,
  priceLabel = "Precio unitario",
}: {
  productos: Producto[];
  priceFieldName: "precioUnitario" | "costoUnitario";
  priceLabel?: string;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [seleccion, setSeleccion] = useState(productos[0]?.id ?? "");

  function agregar() {
    const producto = productos.find((p) => p.id === seleccion);
    if (!producto) return;
    if (items.some((it) => it.productoId === producto.id)) return;
    setItems((prev) => [...prev, { productoId: producto.id, nombre: producto.nombre, cantidad: "1", precio: String(producto.precioDefault) }]);
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

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1">
          <label className="label">Producto</label>
          <select value={seleccion} onChange={(e) => setSeleccion(e.target.value)} className="input">
            {productos.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre} — {formatCOP(p.precioDefault)}</option>
            ))}
          </select>
        </div>
        <button type="button" onClick={agregar} className="btn-secondary">Agregar</button>
      </div>

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
                    <button type="button" onClick={() => quitar(it.productoId)} className="text-xs text-red-500 hover:underline">
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
    </div>
  );
}
