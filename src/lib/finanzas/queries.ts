import { prisma } from "@/lib/prisma";
import type { CategoryType, ChannelContributionRow, PnlRow } from "./calculations";

export const COMPANIES = ["VERAGUA", "MELCOCH"] as const;
export type Company = (typeof COMPANIES)[number];

export const COMPANY_LABEL: Record<Company, string> = {
  VERAGUA: "Veragua",
  MELCOCH: "Melcoch",
};

export const CONSOLIDATED = "CONSOLIDADO";

export interface CompanySelection {
  isConsolidated: boolean;
  company: Company | null; // null si es consolidado
  targets: Company[]; // empresas a consultar
}

export function resolveCompanyParam(value: string | undefined): CompanySelection {
  if (value === CONSOLIDATED) {
    return { isConsolidated: true, company: null, targets: [...COMPANIES] };
  }
  const company = COMPANIES.includes(value as Company) ? (value as Company) : COMPANIES[0];
  return { isConsolidated: false, company, targets: [company] };
}

export async function getCategories(company: Company) {
  return prisma.finCategory.findMany({
    where: { OR: [{ company: null }, { company }] },
    orderBy: { codigo: "asc" },
  });
}

export async function getChannels(company: Company) {
  return prisma.finChannel.findMany({ where: { company }, orderBy: { nombre: "asc" } });
}

// Carga categorías y canales de ambas empresas a la vez, para el formulario
// de movimientos (permite cambiar de empresa sin recargar la página).
export async function getTransactionFormData() {
  return Promise.all(
    COMPANIES.map(async (company) => ({
      company,
      categories: await getCategories(company),
      channels: await getChannels(company),
    }))
  );
}

export async function getPnlRows(company: Company, start: Date, end: Date): Promise<PnlRow[]> {
  const categories = await getCategories(company);
  const transactions = await prisma.finTransaction.findMany({
    where: { company, anulado: false, fecha: { gte: start, lte: end } },
    select: { categoriaId: true, monto: true },
  });
  const totals = new Map<string, number>();
  for (const t of transactions) {
    totals.set(t.categoriaId, (totals.get(t.categoriaId) ?? 0) + t.monto);
  }
  return categories
    .map((c) => ({
      category_id: c.id,
      category_code: c.codigo,
      category_name: c.nombre,
      category_type: c.tipo as CategoryType,
      total: totals.get(c.id) ?? 0,
    }))
    .filter((r) => r.total !== 0)
    .sort((a, b) => a.category_code.localeCompare(b.category_code));
}

export function mergePnlRows(rowSets: PnlRow[][]): PnlRow[] {
  const byCategory = new Map<string, PnlRow>();
  for (const rows of rowSets) {
    for (const row of rows) {
      const existing = byCategory.get(row.category_id);
      if (existing) existing.total += row.total;
      else byCategory.set(row.category_id, { ...row });
    }
  }
  return Array.from(byCategory.values()).sort((a, b) => a.category_code.localeCompare(b.category_code));
}

export async function getChannelContributionRows(
  company: Company,
  start: Date,
  end: Date
): Promise<ChannelContributionRow[]> {
  const channels = await getChannels(company);
  const transactions = await prisma.finTransaction.findMany({
    where: { company, anulado: false, fecha: { gte: start, lte: end }, canalId: { not: null } },
    select: { canalId: true, tipo: true, monto: true },
  });
  const revenue = new Map<string, number>();
  const costs = new Map<string, number>();
  for (const t of transactions) {
    const id = t.canalId!;
    if (t.tipo === "income") revenue.set(id, (revenue.get(id) ?? 0) + t.monto);
    else costs.set(id, (costs.get(id) ?? 0) + t.monto);
  }
  return channels.map((ch) => ({
    sales_channel_id: ch.id,
    channel_name: ch.nombre,
    revenue: revenue.get(ch.id) ?? 0,
    direct_costs: costs.get(ch.id) ?? 0,
  }));
}

export function mergeChannelRows(rowSets: ChannelContributionRow[][]): ChannelContributionRow[] {
  const byName = new Map<string, ChannelContributionRow>();
  for (const rows of rowSets) {
    for (const row of rows) {
      const existing = byName.get(row.channel_name);
      if (existing) {
        existing.revenue += row.revenue;
        existing.direct_costs += row.direct_costs;
      } else {
        byName.set(row.channel_name, { ...row });
      }
    }
  }
  return Array.from(byName.values()).sort((a, b) => a.channel_name.localeCompare(b.channel_name));
}

export async function getSharedOverhead(company: Company, start: Date, end: Date): Promise<number> {
  const result = await prisma.finTransaction.aggregate({
    where: { company, anulado: false, tipo: "expense", canalId: null, fecha: { gte: start, lte: end } },
    _sum: { monto: true },
  });
  return result._sum.monto ?? 0;
}

export interface MonthlyTrendPoint {
  month: string // "YYYY-MM"
  income: number
  expense: number
}

export async function getMonthlyTrend(company: Company, monthsBack: number, endDate: Date): Promise<MonthlyTrendPoint[]> {
  const start = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth() - (monthsBack - 1), 1, 12, 0, 0));
  const transactions = await prisma.finTransaction.findMany({
    where: { company, anulado: false, fecha: { gte: start } },
    select: { fecha: true, tipo: true, monto: true },
  });

  const points = new Map<string, MonthlyTrendPoint>();
  for (let i = 0; i < monthsBack; i++) {
    const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    points.set(key, { month: key, income: 0, expense: 0 });
  }
  for (const t of transactions) {
    const key = `${t.fecha.getUTCFullYear()}-${String(t.fecha.getUTCMonth() + 1).padStart(2, "0")}`;
    const point = points.get(key);
    if (!point) continue;
    if (t.tipo === "income") point.income += t.monto;
    else point.expense += t.monto;
  }
  return Array.from(points.values());
}

export function mergeMonthlyTrend(sets: MonthlyTrendPoint[][]): MonthlyTrendPoint[] {
  const byMonth = new Map<string, MonthlyTrendPoint>();
  for (const points of sets) {
    for (const p of points) {
      const existing = byMonth.get(p.month);
      if (existing) {
        existing.income += p.income;
        existing.expense += p.expense;
      } else {
        byMonth.set(p.month, { ...p });
      }
    }
  }
  return Array.from(byMonth.values()).sort((a, b) => a.month.localeCompare(b.month));
}

export interface TransactionFilters {
  company: Company;
  from?: Date;
  to?: Date;
  tipo?: "income" | "expense";
}

export async function getTransactions(filters: TransactionFilters) {
  return prisma.finTransaction.findMany({
    where: {
      company: filters.company,
      anulado: false,
      tipo: filters.tipo,
      fecha: filters.from || filters.to ? { gte: filters.from, lte: filters.to } : undefined,
    },
    include: { categoria: true, canal: true },
    orderBy: [{ fecha: "desc" }, { createdAt: "desc" }],
    take: 500,
  });
}
