import { prisma } from "@/lib/prisma";

export interface ResumenConductorRow {
  conductorId: string;
  conductorNombre: string;
  rutasCompletadas: number;
  montoAPagar: number;
  diasAlquiler: number;
  montoACobrar: number;
  gastosCombustiblePeajes: number;
  danosPendiente: number;
  danosDescontado: number;
  danosPagado: number;
}

function diasEntre(desde: Date, hasta: Date): number {
  const dias = Math.round((hasta.getTime() - desde.getTime()) / (24 * 60 * 60 * 1000));
  return Math.max(1, dias);
}

/** Resumen mensual por conductor: rutas completadas × valor por ruta (a pagar), días de
 * alquiler × canon diario (a cobrar), gastos de tanqueo/peajes de las rutas de la
 * empresa, y el ledger de daños/multas (acumulado histórico, no solo del mes, porque un
 * daño de un mes anterior puede seguir pendiente). */
export async function computeResumenMensual(year: number, monthIndex: number): Promise<ResumenConductorRow[]> {
  const inicio = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0));
  const fin = new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999));

  const [settings, salidasCerradas, danios] = await Promise.all([
    prisma.vehiculoSettings.findUnique({ where: { id: "singleton" } }),
    prisma.vehiculoSalida.findMany({
      where: { checkinAt: { gte: inicio, lte: fin } },
      include: { conductor: true, recibos: true },
    }),
    prisma.vehiculoDanioFinanciero.findMany({ include: { conductor: true } }),
  ]);

  const valorPorRuta = settings?.valorPorRuta ?? 0;
  const canonDiarioAlquiler = settings?.canonDiarioAlquiler ?? 0;

  const porConductor = new Map<string, ResumenConductorRow>();
  function fila(conductorId: string, nombre: string): ResumenConductorRow {
    let row = porConductor.get(conductorId);
    if (!row) {
      row = {
        conductorId,
        conductorNombre: nombre,
        rutasCompletadas: 0,
        montoAPagar: 0,
        diasAlquiler: 0,
        montoACobrar: 0,
        gastosCombustiblePeajes: 0,
        danosPendiente: 0,
        danosDescontado: 0,
        danosPagado: 0,
      };
      porConductor.set(conductorId, row);
    }
    return row;
  }

  for (const s of salidasCerradas) {
    const row = fila(s.conductorId, s.conductor.name);
    if (s.tipoUso === "RUTA_EMPRESA") {
      row.rutasCompletadas += 1;
      row.montoAPagar += valorPorRuta;
      row.gastosCombustiblePeajes += s.recibos.reduce((sum, r) => sum + r.valor, 0);
    } else {
      const dias = diasEntre(s.checkoutAt, s.checkinAt!);
      row.diasAlquiler += dias;
      row.montoACobrar += dias * canonDiarioAlquiler;
    }
  }

  for (const d of danios) {
    const row = fila(d.conductorId, d.conductor.name);
    if (d.estado === "PENDIENTE") row.danosPendiente += d.valor;
    else if (d.estado === "DESCONTADO") row.danosDescontado += d.valor;
    else if (d.estado === "PAGADO") row.danosPagado += d.valor;
  }

  return [...porConductor.values()].sort((a, b) => a.conductorNombre.localeCompare(b.conductorNombre));
}
