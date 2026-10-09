import CompanyPicker from "@/components/finanzas/CompanyPicker";
import MetodoPagoPicker from "@/components/finanzas/MetodoPagoPicker";
import SubmitButton from "@/components/SubmitButton";
import { Icon } from "@/components/icons";
import { resolveCompanyParam, COMPANY_LABEL, CONSOLIDATED } from "@/lib/finanzas/queries";
import { formatCOP } from "@/lib/finanzas/format";
import { formatDateOnly, todayColombia } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { registrarPagoProveedor } from "@/lib/actions/inventario-compras";

export default async function CuentasPorPagarPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string }>;
}) {
  const params = await searchParams;
  // Por defecto se ve todo junto (Veragua + Melcoch) — ver la nota en
  // cuentas-por-cobrar/page.tsx: un mismo proveedor que surte a las dos empresas no debe
  // quedar repartido en dos páginas separadas.
  const selection = resolveCompanyParam(params.company ?? CONSOLIDATED);

  const [proveedores, cuentas] = await Promise.all([
    prisma.proveedor.findMany({ orderBy: { nombre: "asc" } }),
    prisma.finCuentaPorPagar.findMany({
      where: { company: { in: selection.targets }, saldo: { gt: 0 } },
      include: { proveedor: true, purchase: { include: { items: { include: { producto: true } } } } },
      orderBy: { fecha: "asc" },
    }),
  ]);

  const saldoPorProveedor = new Map<string, number>();
  const facturasPorProveedor = new Map<string, number>();
  const companiasPorProveedor = new Map<string, Set<string>>();
  for (const c of cuentas) {
    saldoPorProveedor.set(c.proveedorId, (saldoPorProveedor.get(c.proveedorId) ?? 0) + c.saldo);
    facturasPorProveedor.set(c.proveedorId, (facturasPorProveedor.get(c.proveedorId) ?? 0) + 1);
    const set = companiasPorProveedor.get(c.proveedorId) ?? new Set<string>();
    set.add(c.company);
    companiasPorProveedor.set(c.proveedorId, set);
  }
  const totalSaldoProveedores = [...saldoPorProveedor.values()].reduce((s, v) => s + v, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-verde-800">
          Cuentas por Pagar — {selection.isConsolidated ? "Veragua + Melcoch" : COMPANY_LABEL[selection.company!]}
        </h1>
        <CompanyPicker current={params.company ?? CONSOLIDATED} />
      </div>

      {totalSaldoProveedores > 0 && (
        <div className="card flex items-center justify-between">
          <div>
            <p className="text-2xl font-semibold text-tierra-800">{formatCOP(totalSaldoProveedores)}</p>
            <p className="text-sm text-tierra-500">
              {saldoPorProveedor.size} proveedor{saldoPorProveedor.size === 1 ? "" : "es"}
            </p>
          </div>
          <span className="flex h-9 min-w-9 items-center justify-center rounded-full bg-dorado-100 px-2 text-sm font-semibold text-tierra-800">
            {cuentas.length}
          </span>
        </div>
      )}

      <div className="card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-verde-800">Saldo pendiente por proveedor</h2>
          {totalSaldoProveedores > 0 && (
            <span className="text-sm font-semibold text-red-600">{formatCOP(totalSaldoProveedores)}</span>
          )}
        </div>
        {proveedores.filter((p) => (saldoPorProveedor.get(p.id) ?? 0) > 0).length === 0 ? (
          <p className="text-sm text-tierra-500">No le debes a ningún proveedor ahora mismo.</p>
        ) : (
          <div className="divide-y divide-verde-50">
            {proveedores
              .filter((p) => (saldoPorProveedor.get(p.id) ?? 0) > 0)
              .map((p) => {
                const facturas = facturasPorProveedor.get(p.id) ?? 0;
                const companias = [...(companiasPorProveedor.get(p.id) ?? [])];
                return (
                  <details key={p.id} className="group py-1">
                    <summary className="flex cursor-pointer list-none items-center gap-3 rounded-lg px-1 py-2 hover:bg-verde-50/60">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-dorado-100 text-sm font-semibold text-tierra-800">
                        {p.nombre.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-tierra-800">{p.nombre}</p>
                        <p className="text-xs text-tierra-500">{facturas} factura{facturas === 1 ? "" : "s"} pendiente{facturas === 1 ? "" : "s"}</p>
                      </div>
                      <span className="text-sm font-semibold text-red-600">{formatCOP(saldoPorProveedor.get(p.id) ?? 0)}</span>
                      <Icon name="chevron-right" className="h-4 w-4 shrink-0 text-tierra-400 transition-transform group-open:rotate-90" />
                    </summary>

                    <div className="mt-2 space-y-2">
                      <p className="text-xs font-semibold text-tierra-600">Facturas pendientes</p>
                      {cuentas.filter((c) => c.proveedorId === p.id).map((c) => (
                        <details key={c.id} className="group/f rounded-lg border border-verde-100 bg-white">
                          <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
                            <span className="font-medium text-tierra-800">{formatDateOnly(c.fecha)}</span>
                            <span className="text-tierra-500">
                              {c.purchase?.numeroFactura ? `Factura ${c.purchase.numeroFactura}` : c.purchase ? "Compra" : "Saldo / gasto"}
                            </span>
                            {c.perdidaMonto ? <span className="badge bg-red-100 text-red-700">incluye pérdida {formatCOP(c.perdidaMonto)}</span> : null}
                            <span className="ml-auto text-xs text-tierra-500">Total {formatCOP(c.montoTotal)}</span>
                            <span className="font-semibold text-red-600">Debes {formatCOP(c.saldo)}</span>
                          </summary>
                          <div className="space-y-3 border-t border-verde-50 px-3 py-3">
                            {c.purchase && c.purchase.items.length > 0 ? (
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-left text-tierra-500">
                                    <th className="py-1">Producto</th>
                                    <th className="py-1 text-right">Cant.</th>
                                    <th className="py-1 text-right">Costo</th>
                                    <th className="py-1 text-right">Subtotal</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {c.purchase.items.map((it) => (
                                    <tr key={it.id} className="border-t border-verde-50">
                                      <td className="py-1">{it.producto.nombre}</td>
                                      <td className="py-1 text-right">{it.cantidad}</td>
                                      <td className="py-1 text-right">{formatCOP(it.costoUnitario)}</td>
                                      <td className="py-1 text-right">{formatCOP(it.cantidad * it.costoUnitario)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            ) : (
                              <p className="text-xs text-tierra-500">Esta cuenta no tiene productos detallados.</p>
                            )}
                            {(c.notas || c.purchase?.notas) && <p className="text-xs text-tierra-500">{c.notas ?? c.purchase?.notas}</p>}
                            <form action={registrarPagoProveedor} className="flex flex-wrap items-end gap-2">
                              <input type="hidden" name="proveedorId" value={p.id} />
                              <input type="hidden" name="company" value={c.company} />
                              <input type="hidden" name="cuentaId" value={c.id} />
                              <div>
                                <label className="label">Monto a pagar de esta factura</label>
                                <input type="number" name="monto" min="1" max={c.saldo} step="1" defaultValue={c.saldo} required className="input w-32" />
                              </div>
                              <div>
                                <label className="label">Fecha</label>
                                <input type="date" name="fecha" required defaultValue={formatDateOnly(todayColombia())} className="input" />
                              </div>
                              <MetodoPagoPicker metodos={["Efectivo", "Transferencia"]} />
                              <SubmitButton className="btn-secondary">Pagar esta factura</SubmitButton>
                            </form>
                          </div>
                        </details>
                      ))}
                    </div>

                    <div className="mt-2 rounded-lg border border-verde-100 bg-verde-50/40 p-3">
                      <p className="mb-2 text-xs text-tierra-500">O un pago general (se aplica a las facturas más antiguas primero):</p>
                      <form action={registrarPagoProveedor} className="flex flex-wrap items-end gap-2">
                        <input type="hidden" name="proveedorId" value={p.id} />
                        {companias.length > 1 ? (
                          <div>
                            <label className="label">Empresa (a cuál se registra el gasto)</label>
                            <select name="company" required defaultValue={companias[0]} className="input">
                              {companias.map((comp) => (
                                <option key={comp} value={comp}>{COMPANY_LABEL[comp as "VERAGUA" | "MELCOCH"]}</option>
                              ))}
                            </select>
                          </div>
                        ) : (
                          <input type="hidden" name="company" value={companias[0]} />
                        )}
                        <div>
                          <label className="label">Monto pagado</label>
                          <input type="number" name="monto" min="0" step="1" required className="input w-32" />
                        </div>
                        <div>
                          <label className="label">Fecha</label>
                          <input type="date" name="fecha" required defaultValue={formatDateOnly(todayColombia())} className="input" />
                        </div>
                        <MetodoPagoPicker metodos={["Efectivo", "Transferencia"]} />
                        <SubmitButton className="btn-secondary">Registrar pago</SubmitButton>
                      </form>
                      <a
                        href={`/api/inventario/export/historial/proveedor/${p.id}`}
                        className="chip-edit mt-3 inline-flex items-center gap-1"
                      >
                        <Icon name="download" className="h-3.5 w-3.5" />
                        Descargar historial
                      </a>
                    </div>
                  </details>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}
