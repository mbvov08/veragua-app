import Link from "next/link";
import CompanyPicker from "@/components/finanzas/CompanyPicker";
import TransactionTable from "@/components/finanzas/TransactionTable";
import { resolveCompanyParam, getTransactions } from "@/lib/finanzas/queries";
import { formatCOP } from "@/lib/finanzas/format";

const TIPOS = [
  { value: "", label: "Todos" },
  { value: "income", label: "Ingresos" },
  { value: "expense", label: "Egresos" },
];

export default async function MovimientosPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string; tipo?: string }>;
}) {
  const params = await searchParams;
  const selection = resolveCompanyParam(params.company);

  const tipo = params.tipo === "income" || params.tipo === "expense" ? params.tipo : undefined;
  const hrefTipo = (t: string) => {
    const q = new URLSearchParams();
    if (params.company) q.set("company", params.company);
    if (t) q.set("tipo", t);
    return `/finanzas/movimientos${q.size ? `?${q}` : ""}`;
  };

  const perCompany = await Promise.all(selection.targets.map((c) => getTransactions({ company: c, tipo })));
  const rows = perCompany.flat().sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  const total = rows.reduce((sum, r) => sum + r.monto, 0);

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {TIPOS.map((t) => (
            <Link key={t.value} href={hrefTipo(t.value)} className={(tipo ?? "") === t.value ? "btn-primary text-sm" : "btn-outline text-sm"}>
              {t.label}
            </Link>
          ))}
        </div>
        {tipo && (
          <p className="text-sm text-tierra-600">
            {rows.length} {tipo === "income" ? "ingresos" : "egresos"} · total <span className="font-semibold">{formatCOP(total)}</span>
          </p>
        )}
      </div>
      <div className="card">
        <TransactionTable transactions={rows} />
      </div>
    </div>
  );
}
