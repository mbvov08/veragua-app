"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ItemsPicker from "@/components/inventario/SaleItemsPicker";
import EstadoPagoToggle from "@/components/finanzas/EstadoPagoToggle";
import MetodoPagoPicker from "@/components/finanzas/MetodoPagoPicker";
import SubmitButton from "@/components/SubmitButton";
import { formatDateOnly, todayColombia } from "@/lib/date";
import { registrarVenta } from "@/lib/actions/inventario-ventas";

type Producto = { id: string; nombre: string; precioDefault: number; categoria: string };
type Canal = { id: string; nombre: string };
type Cliente = { id: string; nombre: string; telefono: string | null };
export type PedidoPrefill = {
  id: string;
  cliente: string;
  fecha: string;
  items: { productoId: string; nombre: string; cantidad: string; precio: string }[];
  avisos: { texto: string; href?: string }[];
  yaRegistrada: boolean;
};

export default function NuevaVentaForm({
  company,
  companyLabel,
  canales,
  clientes,
  productos,
  pedido,
}: {
  company: string;
  companyLabel: string;
  canales: Canal[];
  clientes: Cliente[];
  productos: Producto[];
  pedido?: PedidoPrefill | null;
}) {
  const router = useRouter();
  const [resetKey, action] = useActionState(async (prevKey: number, formData: FormData) => {
    await registrarVenta(formData);
    // Venta creada desde un pedido: de vuelta a los pedidos entregados, ya con su marca.
    if (pedido) router.push("/pedidos?estado=entregado");
    return prevKey + 1;
  }, 0);
  const [clienteNombre, setClienteNombre] = useState(pedido?.cliente ?? "");
  const clienteSeleccionado = clientes.find((c) => c.nombre.trim().toLowerCase() === clienteNombre.trim().toLowerCase());

  return (
    <form key={resetKey} action={action} className="mt-4 grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="company" value={company} />
      {pedido && <input type="hidden" name="pedidoId" value={pedido.id} />}

      {pedido && (
        <div className="sm:col-span-2 space-y-1 rounded-lg bg-verde-50 p-3 text-xs text-tierra-700">
          <p className="font-medium text-verde-800">Venta del pedido de {pedido.cliente}</p>
          <p>Cliente, fecha y productos ya vienen cargados — elige si fue pagada o fiada. Al guardar se descuenta del inventario.</p>
          {pedido.yaRegistrada && (
            <p className="font-medium text-red-700">Este pedido ya tiene una venta registrada en {companyLabel}.</p>
          )}
          {pedido.items.length === 0 && <p className="text-red-700">Este pedido no tiene productos de {companyLabel}.</p>}
          {pedido.avisos.map((a) => (
            <p key={a.texto}>
              {a.texto}{" "}
              {a.href && (
                <Link href={a.href} className="text-verde-700 underline">
                  Ir a esa venta
                </Link>
              )}
            </p>
          ))}
        </div>
      )}

      <EstadoPagoToggle />

      <ItemsPicker
        productos={productos}
        priceFieldName="precioUnitario"
        priceLabel="Precio unitario"
        initialItems={pedido?.items}
        whatsapp={{ nombre: clienteNombre, telefono: clienteSeleccionado?.telefono ?? null, companyLabel }}
      />

      <MetodoPagoPicker />

      <div>
        <label className="label">Fecha</label>
        <input type="date" name="fecha" required defaultValue={pedido?.fecha ?? formatDateOnly(todayColombia())} className="input" />
      </div>
      <div>
        <label className="label">Canal</label>
        <select name="canalId" className="input">
          <option value="">Sin canal</option>
          {canales.map((ch) => (
            <option key={ch.id} value={ch.id}>{ch.nombre}</option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className="label">Cliente</label>
        <input
          name="clienteNombre"
          list="clientes-existentes"
          className="input"
          placeholder="Nombre del cliente"
          value={clienteNombre}
          onChange={(e) => setClienteNombre(e.target.value)}
        />
        <datalist id="clientes-existentes">
          {clientes.map((c) => (
            <option key={c.id} value={c.nombre} />
          ))}
        </datalist>
      </div>
      <div className="sm:col-span-2">
        <label className="label">Notas</label>
        <textarea name="notas" rows={2} className="input" />
      </div>
      <div className="sm:col-span-2">
        <SubmitButton>Guardar venta</SubmitButton>
      </div>
    </form>
  );
}
