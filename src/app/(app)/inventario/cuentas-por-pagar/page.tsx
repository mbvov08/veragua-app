import InventarioCompanyPicker from "@/components/inventario/CompanyPicker";
import SubmitButton from "@/components/SubmitButton";
import { Icon } from "@/components/icons";
import { resolveCompanyParam, COMPANY_LABEL } from "@/lib/finanzas/queries";
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
  const selection = resolveCompanyParam(params.company);
  const company = selection.company ?? "VERAGUA";

  const [proveedores, cuentas] = await Promise.all([
    prisma.proveedor.findMany({ orderBy: { nombre: "asc" } }),
    prisma.finCuentaPorPagar.findMany({
      where: { company, saldo: { gt: 0 } },
      include: { proveedor: true },
      orderBy: { fecha: "asc" },
    }),
  ]);

  const saldoPorProveedor = new Map<string, number>();
  const facturasPorProveedor = new Map<string, number>();
  for (const c of cuentas) {
    saldoPorProveedor.set(c.proveedorId, (saldoPorProveedor.get(c.proveedorId) ?? 0) + c.saldo);
    facturasPorProveedor.set(c.proveedorId, (facturasPorProveedor.get(c.proveedorId) ?? 0) + 1);
  }
  const totalSaldoProveedores = [...saldoPorProveedor.values()].reduce((s, v) => s + v, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-verde-800">Cuentas por Pagar — {COMPANY_LABEL[company]}</h1>
        <InventarioCompanyPicker current={company} />
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

                    <div className="mt-2 rounded-lg border border-verde-100 bg-verde-50/40 p-3">
                      <form action={registrarPagoProveedor} className="flex flex-wrap items-end gap-2">
                        <input type="hidden" name="proveedorId" value={p.id} />
                        <input type="hidden" name="company" value={company} />
                        <div>
                          <label className="label">Monto pagado</label>
                          <input type="number" name="monto" min="0" step="1" required className="input w-32" />
                        </div>
                        <div>
                          <label className="label">Fecha</label>
                          <input type="date" name="fecha" required defaultValue={formatDateOnly(todayColombia())} className="input" />
                        </div>
                        <div>
                          <label className="label">Método (opcional)</label>
                          <input name="metodoPago" className="input w-32" />
                        </div>
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
