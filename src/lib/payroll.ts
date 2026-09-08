import { prisma } from "@/lib/prisma";
import { colombiaClockOnDate, computeWorkedHours, dayOfWeek } from "@/lib/date";
import { finJornadaOrdinaria } from "@/lib/schedule";

/**
 * Aproximación de nómina colombiana para un empleado con jornada de mostrador.
 * No reemplaza asesoría contable: verificar con un contador antes de pagar,
 * sobre todo si cambian los porcentajes de ley o los horarios de recargo nocturno/dominical.
 */

// Inicio del recargo nocturno. Colombia tiene una reforma laboral en curso (2025-2027) que
// mueve este límite por fases — confirmar si ya cambió antes de asumir 9:00 p.m.
const NOCTURNO_INICIO_HORA = 21;

export type PayrollBreakdown = {
  salarioBase: number;
  diasTrabajados: number;
  divisorMensual: number;
  valorHoraOrdinaria: number;
  horasOrdinarias: number;
  horasExtraDiu: number;
  horasExtraNoc: number;
  horasJustificadas: number;
  horasNoJustificadas: number;
  valorExtraDiu: number;
  valorExtraNoc: number;
  quincenaBase: number;
  extraFijo: number;
  extraFijoLabel: string;
  auxTransporte: number;
  totalDevengado: number;
  ibc: number;
  saludDeduccion: number;
  pensionDeduccion: number;
  totalDeducciones: number;
  descuentoFaltante: number;
  descuentoFaltanteConcepto: string | null;
  netoPagar: number;
  advertencias: string[];
};

/**
 * Calcula horas extra reales: cualquier tiempo trabajado después del fin de la jornada
 * ordinaria pactada para ese día (7pm entre semana, 5pm sábados), dividido en diurna/nocturna
 * según la hora del día. No depende del total semanal: si se queda tarde, es hora extra ya
 * mismo, así la semana no llegue a 42 horas.
 */
async function computeOvertimeFromSchedule(
  userId: string,
  periodStart: Date,
  periodEnd: Date
) {
  const entries = await prisma.timeEntry.findMany({
    where: {
      userId,
      workDate: { gte: periodStart, lte: periodEnd },
      clockOut: { not: null },
    },
  });

  let horasTrabajadasTotal = 0;
  let horasExtraDiu = 0;
  let horasExtraNoc = 0;
  let horasJustificadas = 0;
  let horasNoJustificadas = 0;
  let domingosTrabajados = 0;

  for (const entry of entries) {
    if (!entry.clockOut) continue;
    const dow = dayOfWeek(entry.workDate);
    horasTrabajadasTotal += computeWorkedHours(entry.clockIn, entry.clockOut, dow);

    const finOrdinarioInstant = finJornadaOrdinaria(entry.workDate);
    if (!finOrdinarioInstant) {
      domingosTrabajados += 1;
      continue;
    }
    if (entry.clockOut <= finOrdinarioInstant) continue;

    const nocturnoInstant = colombiaClockOnDate(entry.workDate, NOCTURNO_INICIO_HORA, 0);
    const extraInicio = finOrdinarioInstant;
    const extraFin = entry.clockOut;
    const horasEsteDia = (extraFin.getTime() - extraInicio.getTime()) / 3600000;

    if (nocturnoInstant <= extraInicio) {
      horasExtraNoc += horasEsteDia;
    } else if (nocturnoInstant >= extraFin) {
      horasExtraDiu += horasEsteDia;
    } else {
      horasExtraDiu += (nocturnoInstant.getTime() - extraInicio.getTime()) / 3600000;
      horasExtraNoc += (extraFin.getTime() - nocturnoInstant.getTime()) / 3600000;
    }

    if (entry.esJustificable === false) {
      horasNoJustificadas += horasEsteDia;
    } else {
      // Justificable=true, o sin autoevaluación registrada (dato antiguo): se cuenta como justificada.
      horasJustificadas += horasEsteDia;
    }
  }

  const horasOrdinarias = Math.max(0, horasTrabajadasTotal - horasExtraDiu - horasExtraNoc);

  const advertencias: string[] = [];
  if (domingosTrabajados > 0) {
    advertencias.push(
      `Se registraron ${domingosTrabajados} día(s) domingo trabajado(s) en el periodo. El recargo dominical/festivo no está incluido en este cálculo — verifícalo aparte.`
    );
  }

  return {
    horasOrdinarias,
    horasExtraDiu,
    horasExtraNoc,
    horasJustificadas,
    horasNoJustificadas,
    advertencias,
  };
}

export async function computeQuincena(
  userId: string,
  periodStart: Date,
  periodEnd: Date,
  extraFijoOverride?: number,
  descuentoFaltante = 0,
  descuentoFaltanteConcepto: string | null = null
): Promise<PayrollBreakdown> {
  const [profile, settings] = await Promise.all([
    prisma.employeeProfile.findUnique({ where: { userId } }),
    prisma.payrollSettings.findUnique({ where: { id: "singleton" } }),
  ]);
  if (!profile) throw new Error("El empleado no tiene un perfil laboral configurado.");
  if (!settings) throw new Error("Configura primero los ajustes de nómina.");

  const salarioBase = profile.salarioBase;
  const divisorMensual = settings.divisorHorasMensual;
  const valorHoraOrdinaria = salarioBase / divisorMensual;

  const {
    horasOrdinarias,
    horasExtraDiu,
    horasExtraNoc,
    horasJustificadas,
    horasNoJustificadas,
    advertencias,
  } = await computeOvertimeFromSchedule(userId, periodStart, periodEnd);

  const valorExtraDiu = horasExtraDiu * valorHoraOrdinaria * 1.25;
  const valorExtraNoc = horasExtraNoc * valorHoraOrdinaria * 1.75;

  const quincenaBase = salarioBase / 2;
  const topeAux = settings.smlmv * settings.topeAuxTransporteSmlmv;
  const auxTransporte =
    profile.auxTransporte && salarioBase <= topeAux ? settings.auxilioTransporte / 2 : 0;

  const extraFijo = extraFijoOverride ?? profile.extraQuincenal;
  const extraFijoLabel = profile.extraQuincenalLabel;

  const totalDevengado = quincenaBase + valorExtraDiu + valorExtraNoc + extraFijo + auxTransporte;

  // El auxilio de transporte y el extra fijo (no constitutivo de salario, ej. domicilios)
  // no hacen parte del IBC de salud/pensión. Las horas extra reales sí son salariales.
  const ibc = quincenaBase + valorExtraDiu + valorExtraNoc;
  const saludDeduccion = ibc * settings.porcentajeSalud;
  const pensionDeduccion = ibc * settings.porcentajePension;
  const totalDeducciones = saludDeduccion + pensionDeduccion;
  const netoPagar = totalDevengado - totalDeducciones - descuentoFaltante;

  const diasTrabajados = Math.round(
    (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24) + 1
  );

  return {
    salarioBase,
    diasTrabajados,
    divisorMensual,
    valorHoraOrdinaria,
    horasOrdinarias,
    horasExtraDiu,
    horasExtraNoc,
    horasJustificadas,
    horasNoJustificadas,
    valorExtraDiu,
    valorExtraNoc,
    quincenaBase,
    extraFijo,
    extraFijoLabel,
    auxTransporte,
    totalDevengado,
    ibc,
    saludDeduccion,
    pensionDeduccion,
    totalDeducciones,
    descuentoFaltante,
    descuentoFaltanteConcepto,
    netoPagar,
    advertencias,
  };
}

export type LiquidacionBreakdown = {
  salarioBase: number;
  diasLaborados: number;
  cesantias: number;
  interesesCesantias: number;
  prima: number;
  vacaciones: number;
  totalLiquidacion: number;
};

export function computeLiquidacion(
  salarioBase: number,
  fechaIngreso: Date,
  fechaRetiro: Date
): LiquidacionBreakdown {
  const diasLaborados = Math.max(
    0,
    Math.round((fechaRetiro.getTime() - fechaIngreso.getTime()) / (1000 * 60 * 60 * 24))
  );

  const cesantias = (salarioBase * diasLaborados) / 360;
  const interesesCesantias = (cesantias * diasLaborados * 0.12) / 360;
  const prima = (salarioBase * diasLaborados) / 360;
  const vacaciones = (salarioBase * diasLaborados) / 720;
  const totalLiquidacion = cesantias + interesesCesantias + prima + vacaciones;

  return { salarioBase, diasLaborados, cesantias, interesesCesantias, prima, vacaciones, totalLiquidacion };
}

export type PrimaBreakdown = {
  salarioBase: number;
  diasBase: number;
  valorPrima: number;
  semestreInicio: Date;
  semestreFin: Date;
};

/** Prima de servicios: se paga dos veces al año a todo empleado activo (30 jun y 20 dic). */
export async function computePrimaSemestral(
  userId: string,
  anio: number,
  semestre: 1 | 2
): Promise<PrimaBreakdown> {
  const profile = await prisma.employeeProfile.findUnique({ where: { userId } });
  if (!profile) throw new Error("El empleado no tiene un perfil laboral configurado.");

  const semestreInicio =
    semestre === 1 ? new Date(Date.UTC(anio, 0, 1, 12)) : new Date(Date.UTC(anio, 6, 1, 12));
  const semestreFin =
    semestre === 1 ? new Date(Date.UTC(anio, 5, 30, 12)) : new Date(Date.UTC(anio, 11, 31, 12));

  const inicioEfectivo = profile.fechaIngreso > semestreInicio ? profile.fechaIngreso : semestreInicio;
  const diasBase = Math.max(
    0,
    Math.min(
      180,
      Math.round((semestreFin.getTime() - inicioEfectivo.getTime()) / (1000 * 60 * 60 * 24)) + 1
    )
  );

  const valorPrima = (profile.salarioBase * diasBase) / 360;

  return { salarioBase: profile.salarioBase, diasBase, valorPrima, semestreInicio, semestreFin };
}

export type CesantiasBreakdown = {
  salarioBase: number;
  diasBase: number;
  valorCesantias: number;
  valorIntereses: number;
};

/** Cálculo informativo de lo que corresponde consignar al fondo de cesantías antes del 14 de febrero. */
export async function computeCesantiasAnuales(
  userId: string,
  anio: number
): Promise<CesantiasBreakdown> {
  const profile = await prisma.employeeProfile.findUnique({ where: { userId } });
  if (!profile) throw new Error("El empleado no tiene un perfil laboral configurado.");

  const anioInicio = new Date(Date.UTC(anio, 0, 1, 12));
  const anioFin = new Date(Date.UTC(anio, 11, 31, 12));
  const inicioEfectivo = profile.fechaIngreso > anioInicio ? profile.fechaIngreso : anioInicio;

  const diasBase = Math.max(
    0,
    Math.min(360, Math.round((anioFin.getTime() - inicioEfectivo.getTime()) / (1000 * 60 * 60 * 24)) + 1)
  );

  const valorCesantias = (profile.salarioBase * diasBase) / 360;
  const valorIntereses = (valorCesantias * diasBase * 0.12) / 360;

  return { salarioBase: profile.salarioBase, diasBase, valorCesantias, valorIntereses };
}

export type PagoGalponBreakdown = {
  huevosProducidos: number;
  huevosRotos: number;
  huevosBuenos: number;
  huevosRecibidosLocal: number;
  huevosVerificados: number;
  cubetas: number;
  valorCubeta: number;
  totalPagar: number;
};

/**
 * Pago por producción del encargado del galpón: se paga por cubeta (30 huevos, configurable)
 * en buen estado, verificando que lo que él reporta como producido coincida con lo que
 * realmente entró al local — se paga sobre el menor de los dos totales del periodo.
 */
export async function computePagoGalpon(
  userId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<PagoGalponBreakdown> {
  const settings = await prisma.payrollSettings.findUnique({ where: { id: "singleton" } });
  if (!settings) throw new Error("Configura primero los ajustes de nómina.");

  const [registros, recepciones] = await Promise.all([
    prisma.registroGalpon.findMany({
      where: { userId, fecha: { gte: periodStart, lte: periodEnd } },
    }),
    prisma.recepcionLocal.findMany({
      where: { fecha: { gte: periodStart, lte: periodEnd } },
    }),
  ]);

  const huevosProducidos = registros.reduce((sum, r) => sum + r.huevosProducidos, 0);
  const huevosRotos = registros.reduce((sum, r) => sum + r.huevosRotos, 0);
  const huevosBuenos = huevosProducidos - huevosRotos;
  const huevosRecibidosLocal = recepciones.reduce((sum, r) => sum + r.cantidadRecibida, 0);
  const huevosVerificados = Math.max(0, Math.min(huevosBuenos, huevosRecibidosLocal));

  const cubetas = huevosVerificados / settings.huevosPorCubeta;
  const valorCubeta = settings.valorCubetaGalpon;
  const totalPagar = cubetas * valorCubeta;

  return {
    huevosProducidos,
    huevosRotos,
    huevosBuenos,
    huevosRecibidosLocal,
    huevosVerificados,
    cubetas,
    valorCubeta,
    totalPagar,
  };
}
