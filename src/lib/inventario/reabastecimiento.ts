import { prisma } from "@/lib/prisma";
import { addDays, formatDateOnly, todayColombia } from "@/lib/date";
import { computeProductStocks } from "@/lib/inventario/stock";
import { mapWithConcurrency } from "@/lib/concurrency";
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
 * todos los días son cero). La ventana nunca se extiende antes de la primera venta real
 * del producto, para no diluir el promedio con ceros de un período en que no se vendía.
 * Se usa la primera venta real (no `createdAt`) porque varios productos se recrearon o
 * reorganizaron en el catálogo después de que sus ventas históricas ya existían —
 * `createdAt` quedaría más reciente que ventas reales, cortando el historial a casi nada.
 */
export async function computeDemandStats(productoId: string, ventanaDias = 180): Promise<DemandStats> {
  const hoy = todayColombia();
  const inicioVentana = addDays(hoy, -(ventanaDias - 1));

  const items = await prisma.finSaleItem.findMany({
    where: { productoId, sale: { fecha: { lte: hoy } } },
    select: { cantidad: true, sale: { select: { fecha: true } } },
  });

  let primeraVenta: Date | null = null;
  for (const it of items) {
    if (!primeraVenta || it.sale.fecha < primeraVenta) primeraVenta = it.sale.fecha;
  }
  const inicio = primeraVenta && primeraVenta > inicioVentana ? primeraVenta : inicioVentana;

  const porDia = new Map<string, number>();
  for (const it of items) {
    if (it.sale.fecha < inicio) continue;
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

type RelacionActiva = {
  id: string;
  productoId: string;
  proveedorId: string;
  proveedorNombre: string;
  leadTimeDias: number;
  diasRevision: number;
  costoUnitarioReferencia: number | null;
};

/**
 * Misma matemática que computeDemandStats()/computeSuggestionsForProduct()/
 * registrarForecastSiNecesario(), pero para TODOS los productos con relación activa de
 * una sola pasada: ~6 consultas en total en vez de ~5 por producto (con 30+ productos,
 * eso eran más de 150 consultas secuenciales — suficiente para agotar el pool de
 * conexiones de Prisma o, con una conexión lenta a Supabase, tardar más de un minuto en
 * cargar la página).
 */
export async function computeReabastecimientoBulk(
  company: Company,
  productos: { id: string }[],
  relacionesActivas: RelacionActiva[],
  ventanaDias = 180
): Promise<{ statsPorProducto: Map<string, DemandStats>; sugerenciasPorProducto: Map<string, Suggestion[]> }> {
  const productIds = productos.map((p) => p.id);
  if (productIds.length === 0) return { statsPorProducto: new Map(), sugerenciasPorProducto: new Map() };

  const hoy = todayColombia();
  const inicioVentana = addDays(hoy, -(ventanaDias - 1));

  // Sin filtro de fecha: se necesita la primera venta real de cada producto (puede ser
  // anterior a la ventana) para no clampear el historial a la fecha de creación del
  // registro, que no siempre coincide con desde cuándo se vende de verdad (ver nota en
  // computeDemandStats).
  const [ventas, stocks, enTransitoItems, forecastsDeHoy] = await Promise.all([
    prisma.finSaleItem.findMany({
      where: { productoId: { in: productIds }, sale: { fecha: { lte: hoy } } },
      select: { productoId: true, cantidad: true, sale: { select: { fecha: true } } },
    }),
    computeProductStocks(company),
    prisma.finPurchaseItem.findMany({
      where: { productoId: { in: productIds }, purchase: { recibido: false } },
      select: { productoId: true, cantidad: true, purchase: { select: { proveedorId: true } } },
    }),
    prisma.finDemandForecast.findMany({
      where: { productoId: { in: productIds }, periodoInicio: hoy },
      select: { productoId: true },
    }),
  ]);

  const stockMap = new Map(stocks.map((s) => [s.id, s.stock]));

  const ventasPorProducto = new Map<string, { fecha: Date; cantidad: number }[]>();
  for (const v of ventas) {
    const arr = ventasPorProducto.get(v.productoId) ?? [];
    arr.push({ fecha: v.sale.fecha, cantidad: v.cantidad });
    ventasPorProducto.set(v.productoId, arr);
  }

  const enTransitoMap = new Map<string, number>();
  for (const it of enTransitoItems) {
    const key = `${it.productoId}:${it.purchase.proveedorId}`;
    enTransitoMap.set(key, (enTransitoMap.get(key) ?? 0) + it.cantidad);
  }

  const yaTieneForecastHoy = new Set(forecastsDeHoy.map((f) => f.productoId));

  const statsPorProducto = new Map<string, DemandStats>();
  for (const producto of productos) {
    const ventasProducto = ventasPorProducto.get(producto.id) ?? [];
    let primeraVenta: Date | null = null;
    for (const v of ventasProducto) {
      if (!primeraVenta || v.fecha < primeraVenta) primeraVenta = v.fecha;
    }
    const inicio = primeraVenta && primeraVenta > inicioVentana ? primeraVenta : inicioVentana;

    const porDia = new Map<string, number>();
    for (const v of ventasProducto) {
      if (v.fecha < inicio) continue;
      const key = formatDateOnly(v.fecha);
      porDia.set(key, (porDia.get(key) ?? 0) + v.cantidad);
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

    statsPorProducto.set(producto.id, {
      demandaDiariaProm,
      demandaDiariaDesv,
      diasConDatos,
      confianzaBaja: diasConDatos < 30,
    });
  }

  const relacionesPorProducto = new Map<string, RelacionActiva[]>();
  for (const rel of relacionesActivas) {
    const arr = relacionesPorProducto.get(rel.productoId) ?? [];
    arr.push(rel);
    relacionesPorProducto.set(rel.productoId, arr);
  }

  const sugerenciasPorProducto = new Map<string, Suggestion[]>();
  const nuevosForecasts: {
    productoId: string;
    ventanaDias: number;
    demandaDiariaProm: number;
    demandaDiariaDesv: number;
    periodoInicio: Date;
    periodoFin: Date;
    demandaPronosticada: number;
  }[] = [];

  for (const producto of productos) {
    const stats = statsPorProducto.get(producto.id)!;
    const rels = relacionesPorProducto.get(producto.id) ?? [];
    const stockActual = stockMap.get(producto.id) ?? 0;

    if (stats.diasConDatos >= 2 && !yaTieneForecastHoy.has(producto.id)) {
      const dias = rels.length > 0 ? Math.min(...rels.map((r) => r.diasRevision)) : 7;
      nuevosForecasts.push({
        productoId: producto.id,
        ventanaDias,
        demandaDiariaProm: stats.demandaDiariaProm,
        demandaDiariaDesv: stats.demandaDiariaDesv,
        periodoInicio: hoy,
        periodoFin: addDays(hoy, dias),
        demandaPronosticada: stats.demandaDiariaProm * dias,
      });
    }

    const sugerencias: Suggestion[] = rels.map((rel) => {
      const enTransito = enTransitoMap.get(`${producto.id}:${rel.proveedorId}`) ?? 0;
      const inventarioSeguridad =
        stats.diasConDatos >= 2 ? SERVICE_LEVEL_Z * stats.demandaDiariaDesv * Math.sqrt(rel.leadTimeDias) : 0;
      const puntoReorden = stats.demandaDiariaProm * rel.leadTimeDias + inventarioSeguridad;
      const stockObjetivo = stats.demandaDiariaProm * (rel.leadTimeDias + rel.diasRevision) + inventarioSeguridad;
      const disponibleProyectado = stockActual + enTransito;
      const cantidadSugerida = Math.max(0, Math.round(stockObjetivo - disponibleProyectado));

      return {
        relacionId: rel.id,
        proveedorId: rel.proveedorId,
        proveedorNombre: rel.proveedorNombre,
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
      };
    });
    sugerenciasPorProducto.set(producto.id, sugerencias);
  }

  if (nuevosForecasts.length > 0) {
    await prisma.finDemandForecast.createMany({ data: nuevosForecasts });
  }

  return { statsPorProducto, sugerenciasPorProducto };
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

/** Rellena demandaReal de pronósticos cuyo período ya pasó. Se llama al cargar la página (sin cron). */
export async function rellenarDemandaRealPendiente(company: Company) {
  const hoy = todayColombia();
  const pendientes = await prisma.finDemandForecast.findMany({
    where: { demandaReal: null, periodoFin: { lt: hoy }, producto: { company } },
  });

  await mapWithConcurrency(pendientes, 4, async (f) => {
    const agg = await prisma.finSaleItem.aggregate({
      where: { productoId: f.productoId, sale: { fecha: { gte: f.periodoInicio, lte: f.periodoFin } } },
      _sum: { cantidad: true },
    });
    await prisma.finDemandForecast.update({
      where: { id: f.id },
      data: { demandaReal: agg._sum.cantidad ?? 0 },
    });
  });
}

export async function getForecastHistory(company: Company, take = 30) {
  return prisma.finDemandForecast.findMany({
    where: { producto: { company }, demandaReal: { not: null } },
    include: { producto: true },
    orderBy: { periodoFin: "desc" },
    take,
  });
}

export type GalponBalance = {
  productoId: string;
  productoNombre: string;
  produccionDiariaProm: number;
  diasConRegistro: number;
  demandaDiariaProm: number;
  balance: number; // producción − demanda; negativo = falta producción
  deficit: boolean;
};

/**
 * Promedio diario de huevos netos (producidos − rotos) registrados en el galpón.
 * A diferencia de la demanda, NO se rellenan ceros en días sin registro: una gallina
 * pone todos los días, así que un día sin registro casi siempre es un olvido de
 * registrarlo, no una producción real de cero.
 */
async function computeProduccionGalponDiaria(ventanaDias = 90): Promise<{ promedio: number; diasConRegistro: number }> {
  const hoy = todayColombia();
  const inicio = addDays(hoy, -(ventanaDias - 1));

  const registros = await prisma.registroGalpon.findMany({
    where: { fecha: { gte: inicio, lte: hoy } },
    select: { fecha: true, huevosProducidos: true, huevosRotos: true },
  });

  const porDia = new Map<string, number>();
  for (const r of registros) {
    const key = formatDateOnly(r.fecha);
    const neto = r.huevosProducidos - r.huevosRotos;
    porDia.set(key, (porDia.get(key) ?? 0) + neto);
  }

  const dias = [...porDia.values()];
  const promedio = dias.length > 0 ? dias.reduce((s, v) => s + v, 0) / dias.length : 0;
  return { promedio, diasConRegistro: dias.length };
}

/** Productos marcados como "se producen en el galpón", comparando producción vs. demanda. */
export async function computeGalponBalances(company: Company): Promise<GalponBalance[]> {
  const productos = await prisma.finProduct.findMany({
    where: { company, comparaConGalpon: true, activo: true },
  });
  if (productos.length === 0) return [];

  const { promedio: produccionDiariaProm, diasConRegistro } = await computeProduccionGalponDiaria();

  const statsPorProducto = await mapWithConcurrency(productos, 4, (p) => computeDemandStats(p.id));

  return productos.map((producto, i) => {
    const stats = statsPorProducto[i];
    // La demanda está en unidades del producto (ej. cartones de 30); se convierte a
    // unidades del galpón (huevos sueltos) para comparar contra la producción.
    const demandaEnUnidadesGalpon = stats.demandaDiariaProm * producto.unidadesGalpon;
    return {
      productoId: producto.id,
      productoNombre: producto.nombre,
      produccionDiariaProm,
      diasConRegistro,
      demandaDiariaProm: demandaEnUnidadesGalpon,
      balance: produccionDiariaProm - demandaEnUnidadesGalpon,
      deficit: produccionDiariaProm < demandaEnUnidadesGalpon,
    };
  });
}
