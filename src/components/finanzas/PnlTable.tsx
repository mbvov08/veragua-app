import { formatCOP } from "@/lib/finanzas/format";
import type { PnlSection, PnlStatement } from "@/lib/finanzas/calculations";

function SectionRows({ section }: { section: PnlSection }) {
  if (section.rows.length === 0) return null;
  return (
    <>
      {section.rows.map((row) => (
        <div key={row.category_id} className="flex justify-between py-1 pl-4 text-sm text-tierra-500">
          <span>
            {row.category_code} · {row.category_name}
          </span>
          <span>{formatCOP(row.total)}</span>
        </div>
      ))}
    </>
  );
}

function SubtotalRow({ label, value, emphasis }: { label: string; value: number; emphasis?: boolean }) {
  return (
    <div className={`flex justify-between border-t border-verde-100 py-2 ${emphasis ? "text-base font-semibold" : "text-sm font-medium"}`}>
      <span>{label}</span>
      <span className={value < 0 ? "text-red-600" : ""}>{formatCOP(value)}</span>
    </div>
  );
}

export default function PnlTable({ statement }: { statement: PnlStatement }) {
  return (
    <div className="space-y-1">
      <div className="pt-2 pb-1 text-sm font-medium text-verde-800">{statement.ingresosOperacionales.label}</div>
      <SectionRows section={statement.ingresosOperacionales} />
      <SubtotalRow label="Total Ingresos Operacionales" value={statement.ingresosOperacionales.total} />

      <div className="pt-3 pb-1 text-sm font-medium text-verde-800">{statement.costoVenta.label}</div>
      <SectionRows section={statement.costoVenta} />
      <SubtotalRow label="Total Costo de Ventas" value={-statement.costoVenta.total} />

      <SubtotalRow label="= Utilidad Bruta" value={statement.utilidadBruta} emphasis />

      <div className="pt-3 pb-1 text-sm font-medium text-verde-800">{statement.gastoAdmin.label}</div>
      <SectionRows section={statement.gastoAdmin} />
      <SubtotalRow label="Total Gastos de Administración" value={-statement.gastoAdmin.total} />

      <div className="pt-3 pb-1 text-sm font-medium text-verde-800">{statement.gastoVentas.label}</div>
      <SectionRows section={statement.gastoVentas} />
      <SubtotalRow label="Total Gastos de Ventas" value={-statement.gastoVentas.total} />

      <SubtotalRow label="= Utilidad Operacional (EBIT)" value={statement.utilidadOperacional} emphasis />

      <div className="pt-3 pb-1 text-sm font-medium text-verde-800">{statement.ingresosNoOperacionales.label}</div>
      <SectionRows section={statement.ingresosNoOperacionales} />

      <div className="pt-3 pb-1 text-sm font-medium text-verde-800">{statement.gastoNoOperacional.label}</div>
      <SectionRows section={statement.gastoNoOperacional} />
      <SubtotalRow
        label="+/- Resultado No Operacional"
        value={statement.ingresosNoOperacionales.total - statement.gastoNoOperacional.total}
      />

      <SubtotalRow label="= Utilidad Antes de Impuestos" value={statement.utilidadAntesImpuestos} emphasis />

      <div className="pt-3 pb-1 text-sm font-medium text-verde-800">{statement.impuesto.label}</div>
      <SectionRows section={statement.impuesto} />
      <SubtotalRow label="Total Impuestos" value={-statement.impuesto.total} />

      <SubtotalRow label="= Utilidad Neta" value={statement.utilidadNeta} emphasis />
    </div>
  );
}
