import InventarioCompanyPicker from "@/components/inventario/CompanyPicker";
import SubmitButton from "@/components/SubmitButton";
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

  const saldoPorCliente = new Map<string, { id: string; nombre: string; saldo: number }>();
  for (const c of cuentas) {
    const prev = saldoPorCliente.get(c.clienteId);
    saldoPorCliente.set(c.clienteId, {
      id: c.clienteId,
      nombre: c.cliente.nombre,
      saldo: (prev?.saldo ?? 0) + c.saldo,
    });
  }
  const clientesConSaldo = [...saldoPorCliente.values()].sort((a, b) => b.saldo - a.saldo);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-verde-800">Clientes — Cuentas por Cobrar — {COMPANY_LABEL[company]}</h1>
        <InventarioCompanyPicker current={company} />
      </div>

      <div className="card">
        <h2 className="mb-3 text-sm font-semibold text-verde-800">Saldo pendiente por cliente</h2>
        {clientesConSaldo.length === 0 ? (
          <p className="text-sm text-tierra-500">Ningún cliente te debe nada ahora mismo.</p>
        ) : (
          <div className="space-y-3">
            {clientesConSaldo.map((c) => (
              <div key={c.id} className="rounded-lg border border-verde-100 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium text-tierra-800">{c.nombre}</span>
                  <span className="text-sm font-semibold text-red-600">{formatCOP(c.saldo)}</span>
                </div>
                <form action={registrarPagoCliente} className="mt-2 flex flex-wrap items-end gap-2">
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
                <div className="mt-2 flex flex-wrap gap-3 text-xs">
                  <a href={`/api/inventario/export/historial/cliente/${c.id}`} className="text-verde-700 hover:underline">
                    Descargar historial
                  </a>
                  <form action={`/api/inventario/export/cuenta-cobro`} method="get" className="flex items-center gap-2">
                    <input type="hidden" name="clienteId" value={c.id} />
                    <span className="text-tierra-500">Cuenta de cobro desde</span>
                    <input type="date" name="start" required className="input w-36 py-1" />
                    <span className="text-tierra-500">hasta</span>
                    <input type="date" name="end" required defaultValue={formatDateOnly(todayColombia())} className="input w-36 py-1" />
                    <button type="submit" className="text-verde-700 hover:underline">Generar PDF</button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
