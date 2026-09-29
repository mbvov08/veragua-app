// Lógica del Estado de Resultados (PyG) y del margen de contribución por
// canal. Portado casi 1:1 desde Veragua ERP (lib/pnl/calculations.ts) — se
// mantiene como funciones puras, testeables sin base de datos.

export type CategoryType =
  | "ingreso_operacional"
  | "ingreso_no_operacional"
  | "costo_venta"
  | "gasto_admin"
  | "gasto_ventas"
  | "gasto_no_operacional"
  | "impuesto";

export interface PnlRow {
  category_id: string;
  category_code: string;
  category_name: string;
  category_type: CategoryType;
  total: number;
}

export interface ChannelContributionRow {
  sales_channel_id: string;
  channel_name: string;
  revenue: number;
  direct_costs: number;
}

export interface PnlSection {
  label: string;
  rows: PnlRow[];
  total: number;
}

export interface PnlStatement {
  ingresosOperacionales: PnlSection;
  costoVenta: PnlSection;
  utilidadBruta: number;
  gastoAdmin: PnlSection;
  gastoVentas: PnlSection;
  utilidadOperacional: number;
  ingresosNoOperacionales: PnlSection;
  gastoNoOperacional: PnlSection;
  utilidadAntesImpuestos: number;
  impuesto: PnlSection;
  utilidadNeta: number;
}

const SECTION_LABELS: Record<CategoryType, string> = {
  ingreso_operacional: "Ingresos Operacionales",
  ingreso_no_operacional: "Ingresos No Operacionales",
  costo_venta: "Costo de Ventas",
  gasto_admin: "Gastos de Administración",
  gasto_ventas: "Gastos de Ventas",
  gasto_no_operacional: "Gastos No Operacionales",
  impuesto: "Impuestos",
}

function section(rows: PnlRow[], type: CategoryType): PnlSection {
  const filtered = rows.filter((r) => r.category_type === type)
  return {
    label: SECTION_LABELS[type],
    rows: filtered,
    total: filtered.reduce((sum, r) => sum + Number(r.total), 0),
  }
}

export function buildPnlStatement(rows: PnlRow[]): PnlStatement {
  const ingresosOperacionales = section(rows, "ingreso_operacional")
  const costoVenta = section(rows, "costo_venta")
  const utilidadBruta = ingresosOperacionales.total - costoVenta.total

  const gastoAdmin = section(rows, "gasto_admin")
  const gastoVentas = section(rows, "gasto_ventas")
  const utilidadOperacional = utilidadBruta - gastoAdmin.total - gastoVentas.total

  const ingresosNoOperacionales = section(rows, "ingreso_no_operacional")
  const gastoNoOperacional = section(rows, "gasto_no_operacional")
  const utilidadAntesImpuestos =
    utilidadOperacional + ingresosNoOperacionales.total - gastoNoOperacional.total

  const impuesto = section(rows, "impuesto")
  const utilidadNeta = utilidadAntesImpuestos - impuesto.total

  return {
    ingresosOperacionales,
    costoVenta,
    utilidadBruta,
    gastoAdmin,
    gastoVentas,
    utilidadOperacional,
    ingresosNoOperacionales,
    gastoNoOperacional,
    utilidadAntesImpuestos,
    impuesto,
    utilidadNeta,
  }
}

export interface ChannelContribution extends ChannelContributionRow {
  contributionMargin: number
  contributionMarginPct: number | null
}

export function buildChannelContributions(rows: ChannelContributionRow[]): ChannelContribution[] {
  return rows.map((row) => {
    const contributionMargin = row.revenue - row.direct_costs
    return {
      ...row,
      contributionMargin,
      contributionMarginPct: row.revenue > 0 ? contributionMargin / row.revenue : null,
    }
  })
}

export function reconcileChannelsWithPnl(
  channels: ChannelContribution[],
  sharedOverhead: number,
  utilidadOperacional: number
): { expected: number; actual: number; difference: number; isConsistent: boolean } {
  const actual = channels.reduce((sum, c) => sum + c.contributionMargin, 0) - sharedOverhead
  const difference = Math.round((actual - utilidadOperacional) * 100) / 100
  return {
    expected: utilidadOperacional,
    actual,
    difference,
    isConsistent: Math.abs(difference) < 0.01,
  }
}
