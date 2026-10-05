import InventarioCompanyPicker from "@/components/inventario/CompanyPicker";
import SubmitButton from "@/components/SubmitButton";
import ConfirmButton from "@/components/ConfirmButton";
import ArmarPedidoWhatsApp from "@/components/inventario/ArmarPedidoWhatsApp";
import { resolveCompanyParam, COMPANY_LABEL } from "@/lib/finanzas/queries";
import { formatDateOnly } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import {
  computeReabastecimientoBulk,
  computeGalponBalances,
  rellenarDemandaRealPendiente,
  getForecastHistory,
} from "@/lib/inventario/reabastecimiento";
import {
  crearRelacionProductoProveedor,
  toggleRelacionProductoProveedorActiva,
} from "@/lib/actions/inventario-reabastecimiento";

const OPCIONES_REVISION = [7, 14, 30, 60, 90];

export default async function ReabastecimientoPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string }>;
}) {
  const params = await searchParams;
  const selection = resolveCompanyParam(params.company);
  const company = selection.company ?? "VERAGUA";

  await rellenarDemandaRealPendiente(company);

  const [productos, proveedores, relaciones, forecastHistory] = await Promise.all([
    prisma.finProduct.findMany({ where: { company, activo: true, esServicio: false }, orderBy: { nombre: "asc" } }),
    prisma.proveedor.findMany({ orderBy: { nombre: "asc" } }),
    prisma.finProductoProveedor.findMany({
      where: { producto: { company } },
      include: { producto: true, proveedor: true },
      orderBy: { createdAt: "desc" },
    }),
    getForecastHistory(company, 20),
  ]);

  const galponBalances = await computeGalponBalances(company);
  const proveedoresInsumos = proveedores.filter((p) => p.tipo === "insumos");

  const relacionesActivas = relaciones.filter((r) => r.activo);
  const productosConRelacion = new Map<string, (typeof productos)[number]>();
  for (const r of relacionesActivas) productosConRelacion.set(r.productoId, r.producto);

  const { statsPorProducto, sugerenciasPorProducto } = await computeReabastecimientoBulk(
    company,
    [...productosConRelacion.values()],
    relacionesActivas.map((r) => ({
      id: r.id,
      productoId: r.productoId,
      proveedorId: r.proveedorId,
      proveedorNombre: r.proveedor.nombre,
      leadTimeDias: r.leadTimeDias,
      diasRevision: r.diasRevision,
      costoUnitarioReferencia: r.costoUnitarioReferencia,
    }))
  );

  // Agrupa sugerencias por proveedor, para prellenar el armador de pedidos.
  const sugerenciasPorProveedor: Record<string, { productoId: string; nombre: string; cantidad: number }[]> = {};
  for (const [productoId, sugerencias] of sugerenciasPorProducto) {
    const producto = productosConRelacion.get(productoId)!;
    for (const s of sugerencias) {
      if (s.cantidadSugerida <= 0) continue;
      const arr = sugerenciasPorProveedor[s.proveedorId] ?? [];
      arr.push({ productoId, nombre: producto.nombre, cantidad: s.cantidadSugerida });
      sugerenciasPorProveedor[s.proveedorId] = arr;
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-verde-800">Reabastecimiento — {COMPANY_LABEL[company]}</h1>
        <InventarioCompanyPicker current={company} />
      </div>

      {proveedoresInsumos.length > 0 && (
        <div className="card">
          <h2 className="mb-3 text-sm font-semibold text-verde-800">Armar pedido</h2>
          <ArmarPedidoWhatsApp
            companyLabel={COMPANY_LABEL[company]}
            proveedores={proveedoresInsumos.map((p) => ({ id: p.id, nombre: p.nombre, telefono: p.telefono }))}
            productos={productos.map((p) => ({ id: p.id, nombre: p.nombre }))}
            sugerenciasPorProveedor={sugerenciasPorProveedor}
          />
        </div>
      )}

      <details className="card">
        <summary className="cursor-pointer text-sm font-semibold text-verde-800">Configurar proveedor y lead time</summary>
        {productos.length === 0 || proveedoresInsumos.length === 0 ? (
          <p className="mt-3 text-sm text-tierra-500">Necesitas al menos un producto y un proveedor de insumos creados.</p>
        ) : (
          <form action={crearRelacionProductoProveedor} className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Producto</label>
              <select name="productoId" required className="input">
                {productos.map((p) => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Proveedor</label>
              <select name="proveedorId" required className="input">
                {proveedoresInsumos.map((p) => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Lead time (días que tarda en llegar)</label>
              <input type="number" name="leadTimeDias" min="1" step="1" required className="input" />
            </div>
            <div>
              <label className="label">Cada cuánto se revisa/pide</label>
              <select name="diasRevision" required defaultValue="" className="input">
                <option value="" disabled>Elige un período</option>
                {OPCIONES_REVISION.map((d) => (
                  <option key={d} value={d}>{d} días</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label">Costo unitario de referencia (opcional)</label>
              <input type="number" name="costoUnitarioReferencia" min="0" step="1" className="input" />
            </div>
            <div className="sm:col-span-2">
              <SubmitButton>Guardar relación</SubmitButton>
            </div>
          </form>
        )}
      </details>

      {relaciones.length > 0 && (
        <div className="card overflow-x-auto">
          <h2 className="mb-3 text-sm font-semibold text-verde-800">Relaciones producto-proveedor</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-verde-100 text-left text-xs text-tierra-500">
                <th className="py-2 pr-2">Producto</th>
                <th className="py-2 pr-2">Proveedor</th>
                <th className="py-2 pr-2">Lead time</th>
                <th className="py-2 pr-2">Revisión</th>
                <th className="py-2 pr-2"></th>
              </tr>
            </thead>
            <tbody>
              {relaciones.map((r) => (
                <tr key={r.id} className="border-b border-verde-50">
                  <td className="py-2 pr-2">{r.producto.nombre}</td>
                  <td className="py-2 pr-2 text-tierra-500">{r.proveedor.nombre}</td>
                  <td className="py-2 pr-2">{r.leadTimeDias} días</td>
                  <td className="py-2 pr-2">{r.diasRevision} días</td>
                  <td className="py-2 pr-2 text-right">
                    <ConfirmButton
                      action={toggleRelacionProductoProveedorActiva.bind(null, r.id, !r.activo)}
                      confirmMessage={r.activo ? "¿Desactivar esta relación?" : "¿Reactivar esta relación?"}
                      className="chip-edit"
                    >
                      {r.activo ? "Desactivar" : "Activar"}
                    </ConfirmButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {galponBalances.length > 0 && (
        <div className="card">
          <h2 className="mb-3 text-sm font-semibold text-verde-800">Producción propia (galpón) vs. demanda</h2>
          <div className="space-y-3">
            {galponBalances.map((b) => (
              <div key={b.productoId} className="rounded-lg border border-verde-100 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium text-tierra-800">{b.productoNombre}</span>
                  {b.diasConRegistro === 0 ? (
                    <span className="text-xs text-tierra-500">Sin registros de producción todavía en Postura/Huevos.</span>
                  ) : b.deficit ? (
                    <span className="badge bg-red-100 text-red-700">
                      Faltan {Math.abs(b.balance).toFixed(1)}/día — considera comprar a tu proveedor de respaldo
                    </span>
                  ) : (
                    <span className="badge bg-verde-100 text-verde-700">Sobran {b.balance.toFixed(1)}/día</span>
                  )}
                </div>
                {b.diasConRegistro > 0 && (
                  <p className="mt-1 text-xs text-tierra-500">
                    Producción: {b.produccionDiariaProm.toFixed(1)}/día ({b.diasConRegistro} días con registro) ·
                    Demanda: {b.demandaDiariaProm.toFixed(1)}/día
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card overflow-x-auto">
        <h2 className="mb-3 text-sm font-semibold text-verde-800">Sugerencias de pedido por producto</h2>
        {productosConRelacion.size === 0 ? (
          <p className="text-sm text-tierra-500">Configura al menos una relación producto-proveedor arriba para ver sugerencias.</p>
        ) : (
          <div className="space-y-4">
            {[...productosConRelacion.entries()].map(([productoId, producto]) => {
              const stats = statsPorProducto.get(productoId)!;
              const sugerencias = sugerenciasPorProducto.get(productoId) ?? [];
              return (
                <div key={productoId} className="rounded-lg border border-verde-100 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium text-tierra-800">{producto.nombre}</span>
                    <span className="text-xs text-tierra-500">
                      {stats.confianzaBaja
                        ? `Datos insuficientes (${stats.diasConDatos} días de historial)`
                        : `Demanda: ${stats.demandaDiariaProm.toFixed(2)}/día (± ${stats.demandaDiariaDesv.toFixed(2)})`}
                    </span>
                  </div>
                  <table className="mt-2 w-full text-sm">
                    <thead>
                      <tr className="border-b border-verde-50 text-left text-xs text-tierra-500">
                        <th className="py-1 pr-2">Proveedor</th>
                        <th className="py-1 pr-2">Lead time</th>
                        <th className="py-1 pr-2">Pto. reorden</th>
                        <th className="py-1 pr-2">Disponible</th>
                        <th className="py-1 pr-2">Objetivo</th>
                        <th className="py-1 pr-2">Sugerido</th>
                        <th className="py-1 pr-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {sugerencias.map((s) => (
                        <tr key={s.relacionId} className="border-b border-verde-50">
                          <td className="py-1 pr-2">{s.proveedorNombre}</td>
                          <td className="py-1 pr-2 text-tierra-500">{s.leadTimeDias}d</td>
                          <td className="py-1 pr-2">{s.puntoReorden.toFixed(1)}</td>
                          <td className="py-1 pr-2">{s.disponibleProyectado.toFixed(1)} {s.enTransito > 0 && <span className="text-tierra-400">(+{s.enTransito} en tránsito)</span>}</td>
                          <td className="py-1 pr-2">{s.stockObjetivo.toFixed(1)}</td>
                          <td className="py-1 pr-2 font-semibold text-verde-700">{s.cantidadSugerida}</td>
                          <td className="py-1 pr-2">
                            {s.pedirYa && <span className="badge bg-red-100 text-red-700">Pedir ya</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {forecastHistory.length > 0 && (
        <div className="card overflow-x-auto">
          <h2 className="mb-3 text-sm font-semibold text-verde-800">Pronóstico vs. realidad</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-verde-100 text-left text-xs text-tierra-500">
                <th className="py-2 pr-2">Producto</th>
                <th className="py-2 pr-2">Período</th>
                <th className="py-2 pr-2">Pronosticado</th>
                <th className="py-2 pr-2">Real</th>
                <th className="py-2 pr-2">Diferencia</th>
              </tr>
            </thead>
            <tbody>
              {forecastHistory.map((f) => {
                const diferencia = (f.demandaReal ?? 0) - f.demandaPronosticada;
                return (
                  <tr key={f.id} className="border-b border-verde-50">
                    <td className="py-2 pr-2">{f.producto.nombre}</td>
                    <td className="py-2 pr-2 text-tierra-500">{formatDateOnly(f.periodoInicio)} a {formatDateOnly(f.periodoFin)}</td>
                    <td className="py-2 pr-2">{f.demandaPronosticada.toFixed(1)}</td>
                    <td className="py-2 pr-2">{f.demandaReal?.toFixed(1)}</td>
                    <td className={`py-2 pr-2 font-medium ${diferencia < 0 ? "text-red-600" : "text-verde-700"}`}>
                      {diferencia > 0 ? "+" : ""}{diferencia.toFixed(1)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
