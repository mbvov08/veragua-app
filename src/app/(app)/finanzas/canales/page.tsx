import CompanyPicker from "@/components/finanzas/CompanyPicker";
import PeriodPicker from "@/components/finanzas/PeriodPicker";
import ChannelContributionChart from "@/components/finanzas/ChannelContributionChart";
import {
  resolveCompanyParam,
  getChannelContributionRows,
  getPnlRows,
  getSharedOverhead,
  mergeChannelRows,
  mergePnlRows,
  COMPANY_LABEL,
} from "@/lib/finanzas/queries";
import { buildChannelContributions, buildPnlStatement, reconcileChannelsWithPnl } from "@/lib/finanzas/calculations";
import { resolvePeriod } from "@/lib/finanzas/period";
import { formatCOP, formatPercent } from "@/lib/finanzas/format";

export default async function CanalesPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string; period?: string; value?: string }>;
}) {
  const params = await searchParams;
  const period = resolvePeriod(params);
  const selection = resolveCompanyParam(params.company);

  const [channelRowSets, pnlRowSets, overheads] = await Promise.all([
    Promise.all(selection.targets.map((c) => getChannelContributionRows(c, period.start, period.end))),
    Promise.all(selection.targets.map((c) => getPnlRows(c, period.start, period.end))),
    Promise.all(selection.targets.map((c) => getSharedOverhead(c, period.start, period.end))),
  ]);

  const contributions = buildChannelContributions(mergeChannelRows(channelRowSets));
  const statement = buildPnlStatement(mergePnlRows(pnlRowSets));
  const sharedOverhead = overheads.reduce((s, v) => s + v, 0);
  const reconciliation = reconcileChannelsWithPnl(contributions, sharedOverhead, statement.utilidadOperacional);

  const title = selection.isConsolidated ? "Consolidado Veragua + Melcoch" : COMPANY_LABEL[selection.company!];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-verde-800">Margen de contribución por canal</h1>
        <div className="flex flex-wrap items-center gap-2">
          <CompanyPicker current={params.company ?? selection.company ?? ""} />
          <PeriodPicker period={period} />
        </div>
      </div>

      <div className="card space-y-4">
        <h2 className="text-sm font-semibold text-tierra-700">
          {title} · {period.label}
        </h2>
        <ChannelContributionChart data={contributions} />

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-verde-100 text-left text-xs text-tierra-500">
                <th className="py-2">Canal</th>
                <th className="py-2 text-right">Ingresos</th>
                <th className="py-2 text-right">Costos directos</th>
                <th className="py-2 text-right">Margen</th>
                <th className="py-2 text-right">% Margen</th>
              </tr>
            </thead>
            <tbody>
              {contributions.map((c) => (
                <tr key={c.sales_channel_id} className="border-b border-verde-50">
                  <td className="py-2 font-medium text-tierra-800">{c.channel_name}</td>
                  <td className="py-2 text-right">{formatCOP(c.revenue)}</td>
                  <td className="py-2 text-right">{formatCOP(c.direct_costs)}</td>
                  <td className={`py-2 text-right font-medium ${c.contributionMargin < 0 ? "text-red-600" : ""}`}>
                    {formatCOP(c.contributionMargin)}
                  </td>
                  <td className="py-2 text-right">{formatPercent(c.contributionMarginPct)}</td>
                </tr>
              ))}
              <tr>
                <td className="py-2 font-medium text-tierra-800">Gastos compartidos (sin canal)</td>
                <td className="py-2 text-right">—</td>
                <td className="py-2 text-right">{formatCOP(sharedOverhead)}</td>
                <td className="py-2 text-right">—</td>
                <td className="py-2 text-right">—</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className={`rounded-lg border p-3 text-sm ${reconciliation.isConsistent ? "border-verde-200 bg-verde-50 text-verde-800" : "border-dorado-300 bg-dorado-50 text-tierra-800"}`}>
          {reconciliation.isConsistent ? (
            <>Chequeo OK: la suma de márgenes por canal menos los gastos compartidos coincide con la Utilidad Operacional del PyG ({formatCOP(reconciliation.expected)}).</>
          ) : (
            <>Atención: hay una diferencia de {formatCOP(reconciliation.difference)} entre la suma de márgenes por canal y la Utilidad Operacional del PyG. Revisa si algún movimiento quedó mal categorizado.</>
          )}
        </div>

        <p className="text-xs text-tierra-400">
          Esta vista mide solo contribución financiera directa por canal. No captura efectos
          cualitativos (ej. el local generando visibilidad de marca), así que un margen negativo en
          un canal es una señal fuerte, no un veredicto automático.
        </p>
      </div>
    </div>
  );
}
