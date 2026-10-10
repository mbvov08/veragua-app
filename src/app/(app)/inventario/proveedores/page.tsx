import InventarioCompanyPicker from "@/components/inventario/CompanyPicker";
import ItemsPicker, { type Item } from "@/components/inventario/SaleItemsPicker";
import SubmitButton from "@/components/SubmitButton";
import ConfirmButton from "@/components/ConfirmButton";
import { Icon } from "@/components/icons";
import ImportarContactoButton from "@/components/ImportarContactoButton";
import { resolveCompanyParam, COMPANY_LABEL } from "@/lib/finanzas/queries";
import { formatCOP } from "@/lib/finanzas/format";
import { formatDateOnly, formatDateShortEs, todayColombia } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { crearProveedor, editarProveedor, registrarCompra, marcarCompraRecibida } from "@/lib/actions/inventario-compras";

export default async function ProveedoresPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string; proveedorId?: string; items?: string }>;
}) {
  const params = await searchParams;
  const selection = resolveCompanyParam(params.company);
  const company = selection.company ?? "VERAGUA";

  const [productos, proveedores, compras] = await Promise.all([
    prisma.finProduct.findMany({ where: { company, activo: true }, include: { categoria: true }, orderBy: { nombre: "asc" } }),
    prisma.proveedor.findMany({ orderBy: { nombre: "asc" } }),
    prisma.finPurchase.findMany({
      where: { company },
      include: { items: { include: { producto: true } }, proveedor: true },
      orderBy: { fecha: "desc" },
      take: 30,
    }),
  ]);

  const proveedoresInsumos = proveedores.filter((p) => p.tipo === "insumos");

  let initialItems: Item[] = [];
  const esPedidoSugerido = Boolean(params.items);
  if (params.items) {
    try {
      const parsed = JSON.parse(params.items) as { productoId: string; cantidad: number }[];
      initialItems = parsed
        .map((it) => {
          const producto = productos.find((p) => p.id === it.productoId);
          if (!producto) return null;
          return { productoId: producto.id, nombre: producto.nombre, cantidad: String(it.cantidad), precio: String(producto.precio) };
        })
        .filter((it): it is Item => it !== null);
    } catch {
      initialItems = [];
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-verde-800">Proveedores — {COMPANY_LABEL[company]}</h1>
        <InventarioCompanyPicker current={company} />
      </div>

      <details className="card">
        <summary className="cursor-pointer text-sm font-semibold text-verde-800">Nuevo proveedor</summary>
        <form action={crearProveedor} className="mt-4 grid gap-3 sm:grid-cols-3">
          <div>
            <label className="label">Nombre</label>
            <input id="proveedorNombre" name="nombre" required className="input" />
          </div>
          <div>
            <label className="label">Teléfono (opcional)</label>
            <input id="proveedorTelefono" name="telefono" className="input" />
          </div>
          <div>
            <label className="label">Contacto (opcional)</label>
            <input name="contacto" className="input" />
          </div>
          <div>
            <label className="label">Tipo</label>
            <select name="tipo" className="input" defaultValue="insumos">
              <option value="insumos">Insumos (proveedor de productos)</option>
              <option value="financiero">Financiero (banco / crédito)</option>
            </select>
          </div>
          <div className="sm:col-span-3">
            <ImportarContactoButton nombreInputId="proveedorNombre" telefonoInputId="proveedorTelefono" />
          </div>
          <div className="sm:col-span-3">
            <SubmitButton>Guardar proveedor</SubmitButton>
          </div>
        </form>
      </details>

      <div className="card">
        <h2 className="mb-3 text-sm font-semibold text-verde-800">Todos los proveedores ({proveedores.length})</h2>
        {proveedores.length === 0 ? (
          <p className="text-sm text-tierra-500">Todavía no hay proveedores registrados.</p>
        ) : (
          <div className="divide-y divide-verde-50">
            {proveedores.map((p) => (
              <details key={p.id} className="group py-1">
                <summary className="flex cursor-pointer list-none items-center gap-3 rounded-lg px-1 py-2 hover:bg-verde-50/60">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-tierra-800">{p.nombre}</p>
                    <p className="text-xs text-tierra-500">
                      {p.contacto ? `${p.contacto}` : "Sin contacto"}
                      {p.telefono ? ` · ${p.telefono}` : ""}
                    </p>
                  </div>
                  {p.tipo === "financiero" && <span className="badge bg-tierra-100 text-tierra-600">Financiero</span>}
                  {!p.telefono && <span className="badge bg-tierra-100 text-tierra-500">Sin teléfono</span>}
                  <Icon name="chevron-right" className="h-4 w-4 shrink-0 text-tierra-400 transition-transform group-open:rotate-90" />
                </summary>
                <form
                  action={editarProveedor.bind(null, p.id)}
                  className="mt-2 grid gap-3 rounded-lg border border-verde-100 bg-verde-50/40 p-3 sm:grid-cols-3"
                >
                  <div>
                    <label className="label">Nombre</label>
                    <input id={`proveedorNombre-${p.id}`} name="nombre" required defaultValue={p.nombre} className="input" />
                  </div>
                  <div>
                    <label className="label">Teléfono</label>
                    <div className="flex items-center gap-2">
                      <input id={`proveedorTelefono-${p.id}`} name="telefono" defaultValue={p.telefono ?? ""} className="input" />
                      <ImportarContactoButton nombreInputId={`proveedorNombre-${p.id}`} telefonoInputId={`proveedorTelefono-${p.id}`} />
                    </div>
                  </div>
                  <div>
                    <label className="label">Contacto</label>
                    <input name="contacto" defaultValue={p.contacto ?? ""} className="input" />
                  </div>
                  <div>
                    <label className="label">Tipo</label>
                    <select name="tipo" className="input" defaultValue={p.tipo}>
                      <option value="insumos">Insumos (proveedor de productos)</option>
                      <option value="financiero">Financiero (banco / crédito)</option>
                    </select>
                  </div>
                  <div className="sm:col-span-3">
                    <SubmitButton className="btn-secondary">Guardar cambios</SubmitButton>
                  </div>
                </form>
              </details>
            ))}
          </div>
        )}
      </div>

      <details id="registrar-compra" className="card scroll-mt-4" open={productos.length > 0 && proveedoresInsumos.length > 0}>
        <summary className="cursor-pointer text-sm font-semibold text-verde-800">Registrar compra</summary>
        {proveedoresInsumos.length === 0 || productos.length === 0 ? (
          <p className="mt-3 text-sm text-tierra-500">Necesitas al menos un proveedor de insumos y un producto creados.</p>
        ) : (
          <form action={registrarCompra} className="mt-4 grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="company" value={company} />
            <div>
              <label className="label">Proveedor</label>
              <select name="proveedorId" required defaultValue={params.proveedorId ?? ""} className="input">
                <option value="" disabled>Selecciona un proveedor</option>
                {proveedoresInsumos.map((p) => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Fecha</label>
              <input type="date" name="fecha" required defaultValue={formatDateOnly(todayColombia())} className="input" />
            </div>
            <div>
              <label className="label">Número de factura (opcional)</label>
              <input name="numeroFactura" className="input" />
            </div>
            <div>
              <label className="label">Estado</label>
              <select name="estado" className="input" defaultValue="pendiente">
                <option value="pagada">Pagada de una vez</option>
                <option value="pendiente">Pendiente (queda en Cuentas por Pagar)</option>
              </select>
            </div>

            <ItemsPicker
              productos={productos.map((p) => ({ id: p.id, nombre: p.nombre, precioDefault: p.precio, categoria: p.categoria.nombre }))}
              priceFieldName="costoUnitario"
              priceLabel="Costo unitario"
              initialItems={initialItems}
            />

            <div className="flex items-center gap-2 sm:col-span-2">
              <input type="checkbox" name="recibido" id="recibido" defaultChecked={!esPedidoSugerido} className="h-4 w-4" />
              <label htmlFor="recibido" className="text-sm text-tierra-700">
                ¿Ya la recibiste? (si la desmarcas, queda como pedido en camino: no suma al stock hasta que la marques recibida)
              </label>
            </div>

            <div className="sm:col-span-2">
              <label className="label">Notas (opcional)</label>
              <textarea name="notas" rows={2} className="input" />
            </div>
            <div className="sm:col-span-2">
              <SubmitButton>Guardar compra</SubmitButton>
            </div>
          </form>
        )}
      </details>

      <div className="card overflow-x-auto">
        <h2 className="mb-3 text-sm font-semibold text-verde-800">Compras recientes</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-verde-100 text-left text-xs text-tierra-500">
              <th className="py-2 pr-2">Fecha</th>
              <th className="py-2 pr-2">Proveedor</th>
              <th className="py-2 pr-2">Productos</th>
              <th className="py-2 pr-2">Total</th>
              <th className="py-2 pr-2">Estado</th>
              <th className="py-2 pr-2">Recibido</th>
              <th className="py-2 pr-2"></th>
            </tr>
          </thead>
          <tbody>
            {compras.map((c) => (
              <tr key={c.id} className="border-b border-verde-50">
                <td className="py-2 pr-2 capitalize">{formatDateShortEs(c.fecha)}</td>
                <td className="py-2 pr-2">{c.proveedor.nombre}</td>
                <td className="py-2 pr-2 text-tierra-500">
                  {c.items.map((it) => `${it.cantidad} ${it.producto.nombre}`).join(", ")}
                </td>
                <td className="py-2 pr-2">{formatCOP(c.total)}</td>
                <td className="py-2 pr-2">
                  <span className={`badge ${c.estado === "pagada" ? "bg-verde-100 text-verde-700" : "bg-tierra-100 text-tierra-600"}`}>
                    {c.estado === "pagada" ? "Pagada" : "Pendiente"}
                  </span>
                </td>
                <td className="py-2 pr-2">
                  {c.recibido ? (
                    <span className="badge bg-verde-100 text-verde-700">Recibido</span>
                  ) : (
                    <ConfirmButton
                      action={marcarCompraRecibida.bind(null, c.id)}
                      confirmMessage="¿Confirmas que ya recibiste este pedido? Esto sumará las cantidades al stock."
                      className="chip-neutral"
                    >
                      Marcar recibido
                    </ConfirmButton>
                  )}
                </td>
                <td className="py-2 pr-2 text-right">
                  <a href={`/api/inventario/export/pedido/${c.id}`} className="chip-edit">
                    {c.recibido ? "Comprobante" : "Pedido PDF"}
                  </a>
                </td>
              </tr>
            ))}
            {compras.length === 0 && (
              <tr><td colSpan={7} className="py-6 text-center text-tierra-500">Sin compras registradas.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
