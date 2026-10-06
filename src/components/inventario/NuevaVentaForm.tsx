"use client";

import { useActionState, useState } from "react";
import ItemsPicker from "@/components/inventario/SaleItemsPicker";
import EstadoPagoToggle from "@/components/finanzas/EstadoPagoToggle";
import MetodoPagoPicker from "@/components/finanzas/MetodoPagoPicker";
import SubmitButton from "@/components/SubmitButton";
import { formatDateOnly, todayColombia } from "@/lib/date";
import { registrarVenta } from "@/lib/actions/inventario-ventas";

type Producto = { id: string; nombre: string; precioDefault: number; categoria: string };
type Canal = { id: string; nombre: string };
type Cliente = { id: string; nombre: string; telefono: string | null };

export default function NuevaVentaForm({
  company,
  companyLabel,
  canales,
  clientes,
  productos,
}: {
  company: string;
  companyLabel: string;
  canales: Canal[];
  clientes: Cliente[];
  productos: Producto[];
}) {
  const [resetKey, action] = useActionState(async (prevKey: number, formData: FormData) => {
    await registrarVenta(formData);
    return prevKey + 1;
  }, 0);
  const [clienteNombre, setClienteNombre] = useState("");
  const clienteSeleccionado = clientes.find((c) => c.nombre.trim().toLowerCase() === clienteNombre.trim().toLowerCase());

  return (
    <form key={resetKey} action={action} className="mt-4 grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="company" value={company} />

      <EstadoPagoToggle />

      <ItemsPicker
        productos={productos}
        priceFieldName="precioUnitario"
        priceLabel="Precio unitario"
        whatsapp={{ nombre: clienteNombre, telefono: clienteSeleccionado?.telefono ?? null, companyLabel }}
      />

      <MetodoPagoPicker />

      <div>
        <label className="label">Fecha</label>
        <input type="date" name="fecha" required defaultValue={formatDateOnly(todayColombia())} className="input" />
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
