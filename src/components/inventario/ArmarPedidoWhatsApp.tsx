"use client";

import { useMemo, useState } from "react";

type Proveedor = { id: string; nombre: string; telefono: string | null };
type Producto = { id: string; nombre: string };
type ItemPedido = { productoId: string; nombre: string; cantidad: string };

/** Ignora tildes al buscar (ej. "kefir" sí encuentra "Kéfir"). */
function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

export default function ArmarPedidoWhatsApp({
  companyLabel,
  proveedores,
  productos,
  sugerenciasPorProveedor,
  stockPorProducto,
}: {
  companyLabel: string;
  proveedores: Proveedor[];
  productos: Producto[];
  sugerenciasPorProveedor: Record<string, { productoId: string; nombre: string; cantidad: number }[]>;
  stockPorProducto: Record<string, number>;
}) {
  const proveedorInicial =
    proveedores.find((p) => (sugerenciasPorProveedor[p.id]?.length ?? 0) > 0)?.id ?? proveedores[0]?.id ?? "";

  const [proveedorId, setProveedorId] = useState(proveedorInicial);
  const [items, setItems] = useState<ItemPedido[]>(
    (sugerenciasPorProveedor[proveedorInicial] ?? []).map((it) => ({ ...it, cantidad: String(it.cantidad) }))
  );
  const [query, setQuery] = useState("");

  const proveedor = proveedores.find((p) => p.id === proveedorId);

  function cambiarProveedor(id: string) {
    setProveedorId(id);
    setItems((sugerenciasPorProveedor[id] ?? []).map((it) => ({ ...it, cantidad: String(it.cantidad) })));
    setQuery("");
  }

  function agregar(producto: Producto) {
    setItems((prev) => {
      if (prev.some((it) => it.productoId === producto.id)) return prev;
      return [...prev, { productoId: producto.id, nombre: producto.nombre, cantidad: "1" }];
    });
    setQuery("");
  }

  function quitar(productoId: string) {
    setItems((prev) => prev.filter((it) => it.productoId !== productoId));
  }

  function cambiarCantidad(productoId: string, cantidad: string) {
    setItems((prev) => prev.map((it) => (it.productoId === productoId ? { ...it, cantidad } : it)));
  }

  const resultadosBusqueda = useMemo(() => {
    const q = normalizar(query);
    if (!q) return [];
    const yaAgregados = new Set(items.map((it) => it.productoId));
    return productos.filter((p) => !yaAgregados.has(p.id) && normalizar(p.nombre).includes(q)).slice(0, 20);
  }, [productos, query, items]);

  const mensaje = useMemo(() => {
    const lineas = items
      .filter((it) => (Number(it.cantidad) || 0) > 0)
      .map((it) => `- ${it.cantidad} x ${it.nombre}`)
      .join("\n");
    return `Hola${proveedor ? ` ${proveedor.nombre.split(" ")[0]}` : ""}! Te escribimos de ${companyLabel} para hacer un pedido:\n${lineas}\n\n¿Nos confirmas disponibilidad y tiempo de entrega? ¡Gracias!`;
  }, [items, proveedor, companyLabel]);

  const hayItems = items.some((it) => (Number(it.cantidad) || 0) > 0);

  const whatsappHref = useMemo(() => {
    const digitos = proveedor?.telefono?.replace(/\D/g, "") ?? "";
    const numero = digitos ? (digitos.startsWith("57") ? digitos : `57${digitos}`) : "";
    return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
  }, [proveedor, mensaje]);

  const itemsParam = encodeURIComponent(
    JSON.stringify(items.filter((it) => (Number(it.cantidad) || 0) > 0).map((it) => ({ productoId: it.productoId, cantidad: Number(it.cantidad) || 0 })))
  );

  return (
    <div className="space-y-3">
      <div>
        <label className="label">Proveedor</label>
        <select value={proveedorId} onChange={(e) => cambiarProveedor(e.target.value)} className="input">
          {proveedores.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
              {(sugerenciasPorProveedor[p.id]?.length ?? 0) > 0 ? ` (${sugerenciasPorProveedor[p.id].length} sugeridos)` : ""}
            </option>
          ))}
        </select>
        {proveedor && !proveedor.telefono && (
          <p className="mt-1 text-xs text-tierra-400">
            Sin teléfono registrado — el mensaje se abrirá en WhatsApp para que elijas el contacto a mano.
          </p>
        )}
      </div>

      {items.length > 0 && (
        <div className="rounded-lg border border-verde-200 bg-white p-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-tierra-500">
                <th className="pb-1">Producto</th>
                <th className="pb-1">Disponible</th>
                <th className="pb-1">Cantidad</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.productoId}>
                  <td className="py-1 pr-2">{it.nombre}</td>
                  <td className="py-1 pr-2 text-tierra-500">{stockPorProducto[it.productoId] ?? "—"}</td>
                  <td className="py-1 pr-2">
                    <input
                      value={it.cantidad}
                      onChange={(e) => cambiarCantidad(it.productoId, e.target.value)}
                      className="input w-20 py-1"
                    />
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
        </div>
      )}

      <div className="rounded-lg border border-verde-100 bg-verde-50/40 p-3">
        <label className="label">Agregar producto</label>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Escribe para buscar..."
          className="input mb-2"
        />
        {resultadosBusqueda.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {resultadosBusqueda.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => agregar(p)}
                className="rounded-full border border-verde-200 bg-verde-50 px-3 py-1 text-xs text-tierra-700 hover:bg-verde-100"
              >
                {p.nombre} <span className="text-tierra-400">(disp. {stockPorProducto[p.id] ?? "—"})</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <a
          href={hayItems ? whatsappHref : undefined}
          target="_blank"
          rel="noreferrer"
          aria-disabled={!hayItems}
          className={`btn-primary text-sm ${hayItems ? "" : "pointer-events-none opacity-50"}`}
        >
          💬 Enviar pedido por WhatsApp
        </a>
        {hayItems && proveedor && (
          <a href={`/inventario/proveedores?proveedorId=${proveedor.id}&items=${itemsParam}`} className="btn-outline text-sm">
            Registrar como compra
          </a>
        )}
      </div>
    </div>
  );
}
