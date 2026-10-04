"use client";

import { useActionState } from "react";
import ItemsPicker from "@/components/inventario/SaleItemsPicker";
import SubmitButton from "@/components/SubmitButton";
import { formatDateOnly, todayColombia } from "@/lib/date";
import { registrarVenta } from "@/lib/actions/inventario-ventas";

type Producto = { id: string; nombre: string; precioDefault: number; categoria: string };
type Canal = { id: string; nombre: string };
type Cliente = { id: string; nombre: string };

export default function NuevaVentaForm({
  company,
  canales,
  clientes,
  productos,
}: {
  company: string;
  canales: Canal[];
  clientes: Cliente[];
  productos: Producto[];
}) {
  const [resetKey, action] = useActionState(async (prevKey: number, formData: FormData) => {
    await registrarVenta(formData);
    return prevKey + 1;
  }, 0);

  return (
    <form key={resetKey} action={action} className="mt-4 grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="company" value={company} />
      <div>
        <label className="label">Fecha</label>
        <input type="date" name="fecha" required defaultValue={formatDateOnly(todayColombia())} className="input" />
      </div>
      <div>
        <label className="label">Canal (opcional)</label>
        <select name="canalId" className="input">
          <option value="">Sin canal</option>
          {canales.map((ch) => (
            <option key={ch.id} value={ch.id}>{ch.nombre}</option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className="label">Cliente (opcional — obligatorio si es fiada)</label>
        <input name="clienteNombre" list="clientes-existentes" className="input" placeholder="Nombre del cliente" />
        <datalist id="clientes-existentes">
          {clientes.map((c) => (
            <option key={c.id} value={c.nombre} />
          ))}
        </datalist>
      </div>

      <ItemsPicker productos={productos} priceFieldName="precioUnitario" priceLabel="Precio unitario" />

      <div className="sm:col-span-2">
        <label className="label">Estado</label>
        <select name="estado" className="input" defaultValue="pagada">
          <option value="pagada">Pagada de una vez</option>
          <option value="pendiente">Fiada (queda en Cuentas por Cobrar)</option>
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className="label">Notas (opcional)</label>
        <textarea name="notas" rows={2} className="input" />
      </div>
      <div className="sm:col-span-2">
        <SubmitButton>Guardar venta</SubmitButton>
      </div>
    </form>
  );
}
