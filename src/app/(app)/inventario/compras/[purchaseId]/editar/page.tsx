import Link from "next/link";
import { notFound } from "next/navigation";
import ItemsPicker, { type Item } from "@/components/inventario/SaleItemsPicker";
import SubmitButton from "@/components/SubmitButton";
import { COMPANY_LABEL } from "@/lib/finanzas/queries";
import { formatDateOnly } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { editarCompra } from "@/lib/actions/inventario-compras";

export default async function EditarCompraPage({ params }: { params: Promise<{ purchaseId: string }> }) {
  const { purchaseId } = await params;
  const compra = await prisma.finPurchase.findUnique({
    where: { id: purchaseId },
    include: {
      items: { include: { producto: true } },
      proveedor: true,
      finTransaction: true,
      cuentaPorPagar: { include: { aplicaciones: true } },
    },
  });
  if (!compra) notFound();

  const [productos, proveedores] = await Promise.all([
    prisma.finProduct.findMany({ where: { company: compra.company, activo: true }, include: { categoria: true }, orderBy: { nombre: "asc" } }),
    prisma.proveedor.findMany({ where: { tipo: "insumos" }, orderBy: { nombre: "asc" } }),
  ]);
  // Si algún producto de la compra ya no está activo, igual debe poder verse y editarse.
  const idsEnLista = new Set(productos.map((p) => p.id));
  const extras = compra.items.filter((it) => !idsEnLista.has(it.productoId)).map((it) => it.producto);
  const listaProductos = [...productos, ...extras];

  const initialItems: Item[] = compra.items.map((it) => ({
    productoId: it.productoId,
    nombre: it.producto.nombre,
    cantidad: String(it.cantidad),
    precio: String(it.costoUnitario),
  }));
  const aplicado = compra.cuentaPorPagar ? compra.cuentaPorPagar.aplicaciones.reduce((s, a) => s + a.montoAplicado, 0) : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-verde-800">Editar compra — {COMPANY_LABEL[compra.company as "VERAGUA" | "MELCOCH"]}</h1>
        <Link href="/inventario/proveedores" className="btn-outline text-sm">Cancelar</Link>
      </div>

      <p className="text-xs text-tierra-500">
        Estado: {compra.estado === "pagada" ? "Pagada" : "Pendiente (en Cuentas por Pagar)"}.{" "}
        {compra.estado === "pagada"
          ? "El gasto asociado se actualiza con el nuevo total."
          : `Ya hay ${aplicado.toLocaleString("es-CO")} pagado a esta compra; el nuevo total no puede ser menor.`}
      </p>

      <form action={editarCompra.bind(null, compra.id)} className="card grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Proveedor</label>
          <select name="proveedorId" required defaultValue={compra.proveedorId} className="input">
            {proveedores.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
            {!proveedores.some((p) => p.id === compra.proveedorId) && (
              <option value={compra.proveedorId}>{compra.proveedor.nombre}</option>
            )}
          </select>
        </div>
        <div>
          <label className="label">Fecha</label>
          <input type="date" name="fecha" required defaultValue={formatDateOnly(compra.fecha)} className="input" />
        </div>
        <div>
          <label className="label">Número de factura (opcional)</label>
          <input name="numeroFactura" defaultValue={compra.numeroFactura ?? ""} className="input" />
        </div>
        {compra.estado === "pagada" && (
          <div>
            <label className="label">Método de pago</label>
            <select name="metodoPago" defaultValue={compra.finTransaction?.metodoPago ?? ""} className="input">
              <option value="">Sin definir</option>
              {["Efectivo", "Transferencia", "Tarjeta"].map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        )}

        <ItemsPicker
          productos={listaProductos.map((p) => ({ id: p.id, nombre: p.nombre, precioDefault: p.precio, categoria: "categoria" in p ? (p as { categoria: { nombre: string } }).categoria.nombre : "Otros" }))}
          priceFieldName="costoUnitario"
          priceLabel="Costo unitario"
          initialItems={initialItems}
        />

        <div className="flex items-center gap-2 sm:col-span-2">
          <input type="checkbox" name="recibido" id="recibido" defaultChecked={compra.recibido} className="h-4 w-4" />
          <label htmlFor="recibido" className="text-sm text-tierra-700">Ya la recibí (suma al stock)</label>
        </div>
        <div className="sm:col-span-2">
          <label className="label">Notas (opcional)</label>
          <textarea name="notas" rows={2} defaultValue={compra.notas ?? ""} className="input" />
        </div>
        <div className="sm:col-span-2">
          <SubmitButton>Guardar cambios</SubmitButton>
        </div>
      </form>
    </div>
  );
}
