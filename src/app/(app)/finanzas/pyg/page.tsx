import Link from "next/link";
import CompanyPicker from "@/components/finanzas/CompanyPicker";
import PeriodPicker from "@/components/finanzas/PeriodPicker";
import PnlTable from "@/components/finanzas/PnlTable";
import { resolveCompanyParam, getPnlRows, mergePnlRows, COMPANY_LABEL } from "@/lib/finanzas/queries";
import { buildPnlStatement } from "@/lib/finanzas/calculations";
import { resolvePeriod } from "@/lib/finanzas/period";
import { formatDateOnly } from "@/lib/date";

export default async function PygPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string; period?: string; value?: string }>;
}) {
  const params = await searchParams;
  const period = resolvePeriod(params);
  const selection = resolveCompanyParam(params.company);

  const rowSets = await Promise.all(selection.targets.map((c) => getPnlRows(c, period.start, period.end)));
  const statement = buildPnlStatement(mergePnlRows(rowSets));

  const title = selection.isConsolidated ? "Consolidado Veragua + Melcoch" : COMPANY_LABEL[selection.company!];
  const exportQuery = `company=${params.company ?? ""}&start=${formatDateOnly(period.start)}&end=${formatDateOnly(period.end)}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-verde-800">Estado de Resultados (PyG)</h1>
        <div className="flex flex-wrap items-center gap-2">
          <CompanyPicker current={params.company ?? selection.company ?? ""} />
          <PeriodPicker period={period} />
          <Link href={`/api/finanzas/export/pyg?${exportQuery}&format=xlsx`} className="btn-outline text-xs">
            Excel
          </Link>
          <Link href={`/api/finanzas/export/pyg?${exportQuery}&format=pdf`} target="_blank" className="btn-outline text-xs">
            PDF
          </Link>
        </div>
      </div>

      <div className="card">
        <h2 className="mb-2 text-sm font-semibold text-tierra-700">
          {title} · {period.label}
        </h2>
        <PnlTable statement={statement} />
      </div>

      <p className="text-xs text-tierra-400">
        Estado de resultados de uso interno gerencial, base caja, sin descomponer IVA (régimen
        simple). No reemplaza la contabilidad oficial.
      </p>
    </div>
  );
}
