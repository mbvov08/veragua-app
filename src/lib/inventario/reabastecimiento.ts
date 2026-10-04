import { prisma } from "@/lib/prisma";
import { addDays, formatDateOnly, todayColombia } from "@/lib/date";
import { computeSingleProductStock } from "@/lib/inventario/stock";
import type { Company } from "@/lib/finanzas/queries";

/** 95% de nivel de servicio. Cambiar aquí si algún día se quiere ajustar. */
export const SERVICE_LEVEL_Z = 1.645;

export type DemandStats = {
  demandaDiariaProm: number;
  demandaDiariaDesv: number;
  diasConDatos: number;
  confianzaBaja: boolean;
};

/**
 * Demanda diaria histórica de un producto, incluyendo los días sin venta como cero
 * (importante para productos de compra poco frecuente como café o gelatos, donde casi
 * todos los días son cero). La ventana nunca se extiende antes de que el producto
 * exista, para no diluir el promedio con ceros de un período en que no se vendía.
 */
export async function computeDemandStats(productoId: string, ventanaDias = 180): Promise<DemandStats> {
  const producto = await prisma.finProduct.findUniqueOrThrow({
    where: { id: productoId },
    select: { createdAt: true },
  });

  const hoy = todayColombia();
  const inicioVentana = addDays(hoy, -(ventanaDias - 1));
  const creado = new Date(Date.UTC(producto.createdAt.getUTCFullYear(), producto.createdAt.getUTCMonth(), producto.createdAt.getUTCDate(), 12));
  const inicio = creado > inicioVentana ? creado : inicioVentana;

  const items = await prisma.finSaleItem.findMany({
    where: { productoId, sale: { fecha: { gte: inicio, lte: hoy } } },
    select: { cantidad: true, sale: { select: { fecha: true } } },
  });

  const porDia = new Map<string, number>();
  for (const it of items) {
    const key = formatDateOnly(it.sale.fecha);
    porDia.set(key, (porDia.get(key) ?? 0) + it.cantidad);
  }

  const valores: number[] = [];
  for (let d = inicio; d <= hoy; d = addDays(d, 1)) {
    valores.push(porDia.get(formatDateOnly(d)) ?? 0);
  }

  const diasConDatos = valores.length;
  const demandaDiariaProm = diasConDatos > 0 ? valores.reduce((s, v) => s + v, 0) / diasConDatos : 0;
  let demandaDiariaDesv = 0;
  if (diasConDatos >= 2) {
    const varianza = valores.reduce((s, v) => s + (v - demandaDiariaProm) ** 2, 0) / (diasConDatos - 1);
    demandaDiariaDesv = Math.sqrt(varianza);
  }

  return {
    demandaDiariaProm,
    demandaDiariaDesv,
    diasConDatos,
    confianzaBaja: diasConDatos < 30,
  };
}

export type Suggestion = {
  relacionId: string;
  proveedorId: string;
  proveedorNombre: string;
  leadTimeDias: number;
  diasRevision: number;
  inventarioSeguridad: number;
  puntoReorden: number;
  stockObjetivo: number;
  stockActual: number;
  enTransito: number;
  disponibleProyectado: number;
  cantidadSugerida: number;
  pedirYa: boolean;
  costoUnitarioReferencia: number | null;
};

export async function computeSuggestionsForProduct(
  productoId: string,
  stats: DemandStats
): Promise<Suggestion[]> {
  const [relaciones, stockActual] = await Promise.all([
    prisma.finProductoProveedor.findMany({
      where: { productoId, activo: true },
      include: { proveedor: true },
    }),
    computeSingleProductStock(productoId),
  ]);

  const sugerencias: Suggestion[] = [];
  for (const rel of relaciones) {
    const enTransitoAgg = await prisma.finPurchaseItem.aggregate({
      where: { productoId, purchase: { proveedorId: rel.proveedorId, recibido: false } },
      _sum: { cantidad: true },
    });
    const enTransito = enTransitoAgg._sum.cantidad ?? 0;

    const inventarioSeguridad =
      stats.diasConDatos >= 2 ? SERVICE_LEVEL_Z * stats.demandaDiariaDesv * Math.sqrt(rel.leadTimeDias) : 0;
    const puntoReorden = stats.demandaDiariaProm * rel.leadTimeDias + inventarioSeguridad;
    const stockObjetivo = stats.demandaDiariaProm * (rel.leadTimeDias + rel.diasRevision) + inventarioSeguridad;
    const disponibleProyectado = stockActual + enTransito;
    const cantidadSugerida = Math.max(0, Math.round(stockObjetivo - disponibleProyectado));

    sugerencias.push({
      relacionId: rel.id,
      proveedorId: rel.proveedorId,
      proveedorNombre: rel.proveedor.nombre,
      leadTimeDias: rel.leadTimeDias,
      diasRevision: rel.diasRevision,
      inventarioSeguridad,
      puntoReorden,
      stockObjetivo,
      stockActual,
      enTransito,
      disponibleProyectado,
      cantidadSugerida,
      pedirYa: disponibleProyectado <= puntoReorden,
      costoUnitarioReferencia: rel.costoUnitarioReferencia,
    });
  }
  return sugerencias;
}

/** Guarda una foto del pronóstico de hoy, una sola vez por día por producto. */
export async function registrarForecastSiNecesario(productoId: string, stats: DemandStats) {
  if (stats.diasConDatos < 2) return;

  const hoy = todayColombia();
  const existente = await prisma.finDemandForecast.findFirst({
    where: { productoId, periodoInicio: hoy },
  });
  if (existente) return;

  const relaciones = await prisma.finProductoProveedor.findMany({
    where: { productoId, activo: true },
    select: { diasRevision: true },
  });
  const dias = relaciones.length > 0 ? Math.min(...relaciones.map((r) => r.diasRevision)) : 7;
  const periodoFin = addDays(hoy, dias);

  await prisma.finDemandForecast.create({
    data: {
      productoId,
      ventanaDias: 180,
      demandaDiariaProm: stats.demandaDiariaProm,
      demandaDiariaDesv: stats.demandaDiariaDesv,
      periodoInicio: hoy,
      periodoFin,
      demandaPronosticada: stats.demandaDiariaProm * dias,
    },
  });
}

/** Rellena demandaReal de pronósticos cuyo período ya pasó. Se llama al cargar la página (sin cron). */
export async function rellenarDemandaRealPendiente(company: Company) {
  const hoy = todayColombia();
  const pendientes = await prisma.finDemandForecast.findMany({
    where: { demandaReal: null, periodoFin: { lt: hoy }, producto: { company } },
  });

  for (const f of pendientes) {
    const agg = await prisma.finSaleItem.aggregate({
      where: { productoId: f.productoId, sale: { fecha: { gte: f.periodoInicio, lte: f.periodoFin } } },
      _sum: { cantidad: true },
    });
    await prisma.finDemandForecast.update({
      where: { id: f.id },
      data: { demandaReal: agg._sum.cantidad ?? 0 },
    });
  }
}

export async function getForecastHistory(company: Company, take = 30) {
  return prisma.finDemandForecast.findMany({
    where: { producto: { company }, demandaReal: { not: null } },
    include: { producto: true },
    orderBy: { periodoFin: "desc" },
    take,
  });
}
