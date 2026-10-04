import { prisma } from "@/lib/prisma";
import type { Company } from "./queries";
import type { MonthlyTrendPoint } from "./queries";

export interface TopProducto {
  productoId: string;
  nombre: string;
  unidadesVendidas: number;
  ingresoGenerado: number;
  precioPromedio: number;
}

/** Ranking de productos por ventas itemizadas (FinSaleItem) en el período. Solo refleja
 * ventas registradas con detalle de producto — los movimientos históricos importados en
 * bloque (sin desglose) no aparecen aquí. */
export async function getTopProductos(company: Company, start: Date, end: Date, take = 10): Promise<TopProducto[]> {
  const items = await prisma.finSaleItem.findMany({
    where: { producto: { company }, sale: { fecha: { gte: start, lte: end } } },
    include: { producto: true },
  });

  const byProduct = new Map<string, { nombre: string; unidades: number; ingreso: number }>();
  for (const it of items) {
    const prev = byProduct.get(it.productoId) ?? { nombre: it.producto.nombre, unidades: 0, ingreso: 0 };
    prev.unidades += it.cantidad;
    prev.ingreso += it.cantidad * it.precioUnitario;
    byProduct.set(it.productoId, prev);
  }

  return [...byProduct.entries()]
    .map(([productoId, v]) => ({
      productoId,
      nombre: v.nombre,
      unidadesVendidas: v.unidades,
      ingresoGenerado: v.ingreso,
      precioPromedio: v.unidades > 0 ? v.ingreso / v.unidades : 0,
    }))
    .sort((a, b) => b.ingresoGenerado - a.ingresoGenerado)
    .slice(0, take);
}

export function mergeTopProductos(sets: TopProducto[][], take = 10): TopProducto[] {
  const byProduct = new Map<string, TopProducto>();
  for (const rows of sets) {
    for (const row of rows) {
      const prev = byProduct.get(row.productoId);
      if (prev) {
        prev.unidadesVendidas += row.unidadesVendidas;
        prev.ingresoGenerado += row.ingresoGenerado;
      } else {
        byProduct.set(row.productoId, { ...row });
      }
    }
  }
  return [...byProduct.values()]
    .map((p) => ({ ...p, precioPromedio: p.unidadesVendidas > 0 ? p.ingresoGenerado / p.unidadesVendidas : 0 }))
    .sort((a, b) => b.ingresoGenerado - a.ingresoGenerado)
    .slice(0, take);
}

export interface ResumenVentas {
  ingresosTotales: number;
  gastosTotales: number;
  balance: number;
  numeroVentas: number;
  ticketPromedio: number;
}

/** KPIs generales en base caja (FinTransaction), independientes de si la venta quedó
 * itemizada o no — así el "ticket promedio" sí refleja todo el período, no solo lo
 * itemizado. */
export async function getResumenVentas(company: Company, start: Date, end: Date): Promise<ResumenVentas> {
  const tx = await prisma.finTransaction.findMany({
    where: { company, anulado: false, fecha: { gte: start, lte: end } },
    select: { tipo: true, monto: true },
  });
  const ingresos = tx.filter((t) => t.tipo === "income");
  const gastos = tx.filter((t) => t.tipo === "expense");
  const ingresosTotales = ingresos.reduce((s, t) => s + t.monto, 0);
  const gastosTotales = gastos.reduce((s, t) => s + t.monto, 0);
  return {
    ingresosTotales,
    gastosTotales,
    balance: ingresosTotales - gastosTotales,
    numeroVentas: ingresos.length,
    ticketPromedio: ingresos.length > 0 ? ingresosTotales / ingresos.length : 0,
  };
}

export function mergeResumenVentas(sets: ResumenVentas[]): ResumenVentas {
  const ingresosTotales = sets.reduce((s, r) => s + r.ingresosTotales, 0);
  const gastosTotales = sets.reduce((s, r) => s + r.gastosTotales, 0);
  const numeroVentas = sets.reduce((s, r) => s + r.numeroVentas, 0);
  return {
    ingresosTotales,
    gastosTotales,
    balance: ingresosTotales - gastosTotales,
    numeroVentas,
    ticketPromedio: numeroVentas > 0 ? ingresosTotales / numeroVentas : 0,
  };
}

/** Igual que getMonthlyTrend pero acotado a un rango de fechas explícito en vez de
 * "últimos N meses", para que el selector de rango de Estadísticas controle el gráfico. */
export async function getMonthlyTrendInRange(company: Company, start: Date, end: Date): Promise<MonthlyTrendPoint[]> {
  const transactions = await prisma.finTransaction.findMany({
    where: { company, anulado: false, fecha: { gte: start, lte: end } },
    select: { fecha: true, tipo: true, monto: true },
  });

  const points = new Map<string, MonthlyTrendPoint>();
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const endMonth = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
  while (cursor <= endMonth) {
    const key = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`;
    points.set(key, { month: key, income: 0, expense: 0 });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  for (const t of transactions) {
    const key = `${t.fecha.getUTCFullYear()}-${String(t.fecha.getUTCMonth() + 1).padStart(2, "0")}`;
    const point = points.get(key);
    if (!point) continue;
    if (t.tipo === "income") point.income += t.monto;
    else point.expense += t.monto;
  }
  return [...points.values()];
}
