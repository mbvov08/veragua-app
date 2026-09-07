import { prisma } from "@/lib/prisma";
import { addDays, computeWorkedHours, dayOfWeek } from "@/lib/date";

/**
 * Aproximación de nómina colombiana para un empleado con jornada de mostrador
 * (sin trabajo nocturno ni dominical). No reemplaza asesoría contable: verificar
 * con un contador antes de pagar, sobre todo si cambian los porcentajes de ley.
 */

export type PayrollBreakdown = {
  salarioBase: number;
  diasTrabajados: number;
  divisorMensual: number;
  valorHoraOrdinaria: number;
  horasOrdinarias: number;
  horasExtraDiu: number;
  horasExtraNoc: number;
  valorExtraDiu: number;
  valorExtraNoc: number;
  quincenaBase: number;
  auxTransporte: number;
  totalDevengado: number;
  ibc: number;
  saludDeduccion: number;
  pensionDeduccion: number;
  totalDeducciones: number;
  netoPagar: number;
};

/** Suma horas extra diurnas trabajadas en la quincena, semana calendario (lun-sáb) a semana calendario. */
async function computeOvertimeHours(
  userId: string,
  periodStart: Date,
  periodEnd: Date,
  horasSemanaLegal: number
) {
  const entries = await prisma.timeEntry.findMany({
    where: {
      userId,
      workDate: { gte: periodStart, lte: periodEnd },
      clockOut: { not: null },
    },
  });

  // Agrupar por semana (lunes de esa semana) para comparar contra el límite legal semanal.
  const byWeekStart = new Map<string, number>();
  for (const entry of entries) {
    if (!entry.clockOut) continue;
    const dow = dayOfWeek(entry.workDate);
    const mondayOffset = dow === 0 ? -6 : 1 - dow;
    const weekStart = addDays(entry.workDate, mondayOffset);
    const key = weekStart.toISOString();
    const worked = computeWorkedHours(entry.clockIn, entry.clockOut, dow);
    byWeekStart.set(key, (byWeekStart.get(key) ?? 0) + worked);
  }

  let horasOrdinarias = 0;
  let horasExtraDiu = 0;
  for (const totalSemana of byWeekStart.values()) {
    if (totalSemana > horasSemanaLegal) {
      horasOrdinarias += horasSemanaLegal;
      horasExtraDiu += totalSemana - horasSemanaLegal;
    } else {
      horasOrdinarias += totalSemana;
    }
  }

  return { horasOrdinarias, horasExtraDiu, horasExtraNoc: 0 };
}

export async function computeQuincena(
  userId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<PayrollBreakdown> {
  const [profile, settings] = await Promise.all([
    prisma.employeeProfile.findUnique({ where: { userId } }),
    prisma.payrollSettings.findUnique({ where: { id: "singleton" } }),
  ]);
  if (!profile) throw new Error("El empleado no tiene un perfil laboral configurado.");
  if (!settings) throw new Error("Configura primero los ajustes de nómina.");

  const salarioBase = profile.salarioBase;
  const divisorMensual = (settings.horasSemanaLegal * 30) / 7;
  const valorHoraOrdinaria = salarioBase / divisorMensual;

  const { horasOrdinarias, horasExtraDiu, horasExtraNoc } = await computeOvertimeHours(
    userId,
    periodStart,
    periodEnd,
    settings.horasSemanaLegal
  );

  const valorExtraDiu = horasExtraDiu * valorHoraOrdinaria * 1.25;
  const valorExtraNoc = horasExtraNoc * valorHoraOrdinaria * 1.75;

  const quincenaBase = salarioBase / 2;
  const topeAux = settings.smlmv * settings.topeAuxTransporteSmlmv;
  const auxTransporte =
    profile.auxTransporte && salarioBase <= topeAux ? settings.auxilioTransporte / 2 : 0;

  const totalDevengado = quincenaBase + valorExtraDiu + valorExtraNoc + auxTransporte;

  // El auxilio de transporte no hace parte del IBC de salud/pensión.
  const ibc = quincenaBase + valorExtraDiu + valorExtraNoc;
  const saludDeduccion = ibc * settings.porcentajeSalud;
  const pensionDeduccion = ibc * settings.porcentajePension;
  const totalDeducciones = saludDeduccion + pensionDeduccion;
  const netoPagar = totalDevengado - totalDeducciones;

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
    valorExtraDiu,
    valorExtraNoc,
    quincenaBase,
    auxTransporte,
    totalDevengado,
    ibc,
    saludDeduccion,
    pensionDeduccion,
    totalDeducciones,
    netoPagar,
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
