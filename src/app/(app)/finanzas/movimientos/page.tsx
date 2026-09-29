import Link from "next/link";
import CompanyPicker from "@/components/finanzas/CompanyPicker";
import TransactionTable from "@/components/finanzas/TransactionTable";
import { resolveCompanyParam, getTransactions } from "@/lib/finanzas/queries";

export default async function MovimientosPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string }>;
}) {
  const params = await searchParams;
  const selection = resolveCompanyParam(params.company);

  const perCompany = await Promise.all(selection.targets.map((c) => getTransactions({ company: c })));
  const rows = perCompany.flat().sort((a, b) => (a.fecha < b.fecha ? 1 : -1));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-verde-800">Movimientos</h1>
        <div className="flex flex-wrap items-center gap-2">
          <CompanyPicker current={params.company ?? selection.company ?? ""} />
          {!selection.isConsolidated && (
            <Link href="/finanzas/nuevo" className="btn-primary text-sm">Nuevo movimiento</Link>
          )}
          <Link
            href={`/api/finanzas/export/movimientos?company=${params.company ?? ""}`}
            className="btn-outline text-sm"
          >
            Exportar Excel
          </Link>
        </div>
      </div>
      <div className="card">
        <TransactionTable transactions={rows} />
      </div>
    </div>
  );
}
