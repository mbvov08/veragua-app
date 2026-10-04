import InventarioCompanyPicker from "@/components/inventario/CompanyPicker";
import SubmitButton from "@/components/SubmitButton";
import { Icon } from "@/components/icons";
import { resolveCompanyParam, COMPANY_LABEL } from "@/lib/finanzas/queries";
import { formatCOP } from "@/lib/finanzas/format";
import { formatDateOnly, todayColombia } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { registrarPagoCliente } from "@/lib/actions/inventario-ventas";

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string }>;
}) {
  const params = await searchParams;
  const selection = resolveCompanyParam(params.company);
  const company = selection.company ?? "VERAGUA";

  const cuentas = await prisma.finCuentaPorCobrar.findMany({
    where: { company, saldo: { gt: 0 } },
    include: { cliente: true },
    orderBy: { fecha: "asc" },
  });

  const saldoPorCliente = new Map<string, { id: string; nombre: string; saldo: number; facturas: number }>();
  for (const c of cuentas) {
    const prev = saldoPorCliente.get(c.clienteId);
    saldoPorCliente.set(c.clienteId, {
      id: c.clienteId,
      nombre: c.cliente.nombre,
      saldo: (prev?.saldo ?? 0) + c.saldo,
      facturas: (prev?.facturas ?? 0) + 1,
    });
  }
  const clientesConSaldo = [...saldoPorCliente.values()].sort((a, b) => b.saldo - a.saldo);
  const totalSaldo = clientesConSaldo.reduce((s, c) => s + c.saldo, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-verde-800">Clientes — Cuentas por Cobrar — {COMPANY_LABEL[company]}</h1>
        <InventarioCompanyPicker current={company} />
      </div>

      <div className="card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-verde-800">Saldo pendiente por cliente</h2>
          {clientesConSaldo.length > 0 && (
            <span className="text-sm font-semibold text-red-600">{formatCOP(totalSaldo)}</span>
          )}
        </div>
        {clientesConSaldo.length === 0 ? (
          <p className="text-sm text-tierra-500">Ningún cliente te debe nada ahora mismo.</p>
        ) : (
          <div className="divide-y divide-verde-50">
            {clientesConSaldo.map((c) => (
              <details key={c.id} className="group py-1">
                <summary className="flex cursor-pointer list-none items-center gap-3 rounded-lg px-1 py-2 hover:bg-verde-50/60">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-dorado-100 text-sm font-semibold text-tierra-800">
                    {c.nombre.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-tierra-800">{c.nombre}</p>
                    <p className="text-xs text-tierra-500">{c.facturas} factura{c.facturas === 1 ? "" : "s"} pendiente{c.facturas === 1 ? "" : "s"}</p>
                  </div>
                  <span className="text-sm font-semibold text-red-600">{formatCOP(c.saldo)}</span>
                  <Icon name="chevron-right" className="h-4 w-4 shrink-0 text-tierra-400 transition-transform group-open:rotate-90" />
                </summary>

                <div className="mt-2 rounded-lg border border-verde-100 bg-verde-50/40 p-3">
                  <form action={registrarPagoCliente} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="clienteId" value={c.id} />
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
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <a href={`/api/inventario/export/historial/cliente/${c.id}`} className="chip-edit inline-flex items-center gap-1">
                      <Icon name="download" className="h-3.5 w-3.5" />
                      Descargar historial
                    </a>
                    <form action={`/api/inventario/export/cuenta-cobro`} method="get" className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="clienteId" value={c.id} />
                      <span className="text-tierra-500">Cuenta de cobro desde</span>
                      <input type="date" name="start" required className="input w-36 py-1" />
                      <span className="text-tierra-500">hasta</span>
                      <input type="date" name="end" required defaultValue={formatDateOnly(todayColombia())} className="input w-36 py-1" />
                      <button type="submit" className="chip-edit inline-flex items-center gap-1">
                        <Icon name="receipt" className="h-3.5 w-3.5" />
                        Generar PDF
                      </button>
                    </form>
                  </div>
                </div>
              </details>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
