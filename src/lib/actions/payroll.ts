"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { dateOnlyToUTC } from "@/lib/date";
import {
  computeQuincena,
  computeLiquidacion,
  computePrimaSemestral,
  computeCesantiasAnuales,
  computePagoGalpon,
} from "@/lib/payroll";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Solo la administradora puede acceder a nómina.");
  }
  return session;
}

export async function updatePayrollSettings(formData: FormData) {
  await requireAdmin();

  const smlmv = Number(formData.get("smlmv"));
  const auxilioTransporte = Number(formData.get("auxilioTransporte"));
  const porcentajeSalud = Number(formData.get("porcentajeSalud")) / 100;
  const porcentajePension = Number(formData.get("porcentajePension")) / 100;
  const horasSemanaLegal = Number(formData.get("horasSemanaLegal"));
  const divisorHorasMensual = Number(formData.get("divisorHorasMensual"));
  const valorCubetaGalpon = Number(formData.get("valorCubetaGalpon"));
  const huevosPorCubeta = Number(formData.get("huevosPorCubeta"));

  await prisma.payrollSettings.upsert({
    where: { id: "singleton" },
    update: {
      smlmv,
      auxilioTransporte,
      porcentajeSalud,
      porcentajePension,
      horasSemanaLegal,
      divisorHorasMensual,
      valorCubetaGalpon,
      huevosPorCubeta,
    },
    create: {
      id: "singleton",
      smlmv,
      auxilioTransporte,
      porcentajeSalud,
      porcentajePension,
      horasSemanaLegal,
      divisorHorasMensual,
      valorCubetaGalpon,
      huevosPorCubeta,
    },
  });

  revalidatePath("/nomina/ajustes");
}

export async function updateEmployeeProfile(formData: FormData) {
  await requireAdmin();

  const userId = String(formData.get("userId") ?? "");
  const cedula = String(formData.get("cedula") ?? "").trim() || null;
  const salarioBase = Number(formData.get("salarioBase"));
  const fechaIngresoStr = String(formData.get("fechaIngreso") ?? "");
  const auxTransporte = formData.get("auxTransporte") === "on";
  const extraQuincenal = Number(formData.get("extraQuincenal") ?? 0);
  const extraQuincenalLabel = String(formData.get("extraQuincenalLabel") ?? "Domicilios").trim() || "Domicilios";
  if (!userId || !fechaIngresoStr) throw new Error("Datos inválidos");

  await prisma.employeeProfile.upsert({
    where: { userId },
    update: {
      cedula,
      salarioBase,
      fechaIngreso: dateOnlyToUTC(fechaIngresoStr),
      auxTransporte,
      extraQuincenal,
      extraQuincenalLabel,
    },
    create: {
      userId,
      cedula,
      salarioBase,
      fechaIngreso: dateOnlyToUTC(fechaIngresoStr),
      auxTransporte,
      extraQuincenal,
      extraQuincenalLabel,
    },
  });

  revalidatePath("/nomina/ajustes");
}

export async function generatePayrollSlip(formData: FormData) {
  const session = await requireAdmin();

  const userId = String(formData.get("userId") ?? "");
  const periodStart = dateOnlyToUTC(String(formData.get("periodStart") ?? ""));
  const periodEnd = dateOnlyToUTC(String(formData.get("periodEnd") ?? ""));
  const extraFijoRaw = formData.get("extraFijo");
  const extraFijoOverride = extraFijoRaw === null || extraFijoRaw === "" ? undefined : Number(extraFijoRaw);
  const descuentoFaltanteRaw = formData.get("descuentoFaltante");
  const descuentoFaltante = descuentoFaltanteRaw === null || descuentoFaltanteRaw === "" ? 0 : Number(descuentoFaltanteRaw);
  const descuentoFaltanteConcepto = String(formData.get("descuentoFaltanteConcepto") ?? "").trim() || null;

  const breakdown = await computeQuincena(
    userId,
    periodStart,
    periodEnd,
    extraFijoOverride,
    descuentoFaltante,
    descuentoFaltante > 0 ? descuentoFaltanteConcepto : null
  );

  await prisma.payrollSlip.create({
    data: {
      userId,
      periodStart,
      periodEnd,
      salarioBase: breakdown.salarioBase,
      diasTrabajados: breakdown.diasTrabajados,
      horasOrdinarias: breakdown.horasOrdinarias,
      horasExtraDiu: breakdown.horasExtraDiu,
      horasExtraNoc: breakdown.horasExtraNoc,
      horasJustificadas: breakdown.horasJustificadas,
      horasNoJustificadas: breakdown.horasNoJustificadas,
      valorExtraDiu: breakdown.valorExtraDiu,
      valorExtraNoc: breakdown.valorExtraNoc,
      extraFijo: breakdown.extraFijo,
      extraFijoLabel: breakdown.extraFijoLabel,
      auxTransporte: breakdown.auxTransporte,
      totalDevengado: breakdown.totalDevengado,
      saludDeduccion: breakdown.saludDeduccion,
      pensionDeduccion: breakdown.pensionDeduccion,
      totalDeducciones: breakdown.totalDeducciones,
      descuentoFaltante: breakdown.descuentoFaltante,
      descuentoFaltanteConcepto: breakdown.descuentoFaltanteConcepto,
      netoPagar: breakdown.netoPagar,
      detalleJson: JSON.stringify(breakdown),
      generadoPorId: session.user.id,
    },
  });

  revalidatePath("/nomina");
}

export async function deletePayrollSlip(id: string) {
  await requireAdmin();
  await prisma.payrollSlip.delete({ where: { id } });
  revalidatePath("/nomina");
}

export async function generateLiquidacion(formData: FormData) {
  const session = await requireAdmin();

  const userId = String(formData.get("userId") ?? "");
  const fechaRetiroStr = String(formData.get("fechaRetiro") ?? "");
  const profile = await prisma.employeeProfile.findUnique({ where: { userId } });
  if (!profile) throw new Error("El empleado no tiene perfil laboral configurado.");

  const fechaRetiro = dateOnlyToUTC(fechaRetiroStr);
  const breakdown = computeLiquidacion(profile.salarioBase, profile.fechaIngreso, fechaRetiro);

  await prisma.liquidacion.create({
    data: {
      userId,
      fechaIngreso: profile.fechaIngreso,
      fechaRetiro,
      salarioBase: breakdown.salarioBase,
      diasLaborados: breakdown.diasLaborados,
      cesantias: breakdown.cesantias,
      interesesCesantias: breakdown.interesesCesantias,
      prima: breakdown.prima,
      vacaciones: breakdown.vacaciones,
      totalLiquidacion: breakdown.totalLiquidacion,
      detalleJson: JSON.stringify(breakdown),
      generadoPorId: session.user.id,
    },
  });

  revalidatePath("/nomina");
}

export async function generatePrimaSemestral(formData: FormData) {
  const session = await requireAdmin();

  const userId = String(formData.get("userId") ?? "");
  const anio = Number(formData.get("anio"));
  const semestre = Number(formData.get("semestre")) === 2 ? 2 : 1;

  const breakdown = await computePrimaSemestral(userId, anio, semestre);

  await prisma.primaPago.upsert({
    where: { userId_anio_semestre: { userId, anio, semestre } },
    update: {
      semestreInicio: breakdown.semestreInicio,
      semestreFin: breakdown.semestreFin,
      salarioBase: breakdown.salarioBase,
      diasBase: breakdown.diasBase,
      valorPrima: breakdown.valorPrima,
      detalleJson: JSON.stringify(breakdown),
      generadoPorId: session.user.id,
    },
    create: {
      userId,
      anio,
      semestre,
      semestreInicio: breakdown.semestreInicio,
      semestreFin: breakdown.semestreFin,
      salarioBase: breakdown.salarioBase,
      diasBase: breakdown.diasBase,
      valorPrima: breakdown.valorPrima,
      detalleJson: JSON.stringify(breakdown),
      generadoPorId: session.user.id,
    },
  });

  revalidatePath("/nomina");
}

export async function generateCesantiasConsignacion(formData: FormData) {
  const session = await requireAdmin();

  const userId = String(formData.get("userId") ?? "");
  const anio = Number(formData.get("anio"));

  const breakdown = await computeCesantiasAnuales(userId, anio);

  await prisma.cesantiasConsignacion.upsert({
    where: { userId_anio: { userId, anio } },
    update: {
      salarioBase: breakdown.salarioBase,
      diasBase: breakdown.diasBase,
      valorCesantias: breakdown.valorCesantias,
      valorIntereses: breakdown.valorIntereses,
      detalleJson: JSON.stringify(breakdown),
      generadoPorId: session.user.id,
    },
    create: {
      userId,
      anio,
      salarioBase: breakdown.salarioBase,
      diasBase: breakdown.diasBase,
      valorCesantias: breakdown.valorCesantias,
      valorIntereses: breakdown.valorIntereses,
      detalleJson: JSON.stringify(breakdown),
      generadoPorId: session.user.id,
    },
  });

  revalidatePath("/nomina");
}

export async function generatePagoGalpon(formData: FormData) {
  const session = await requireAdmin();

  const userId = String(formData.get("userId") ?? "");
  const periodStart = dateOnlyToUTC(String(formData.get("periodStart") ?? ""));
  const periodEnd = dateOnlyToUTC(String(formData.get("periodEnd") ?? ""));

  const breakdown = await computePagoGalpon(userId, periodStart, periodEnd);

  await prisma.pagoGalpon.create({
    data: {
      userId,
      periodStart,
      periodEnd,
      huevosProducidos: breakdown.huevosProducidos,
      huevosRotos: breakdown.huevosRotos,
      huevosRecibidosLocal: breakdown.huevosRecibidosLocal,
      huevosVerificados: breakdown.huevosVerificados,
      cubetas: breakdown.cubetas,
      valorCubeta: breakdown.valorCubeta,
      totalPagar: breakdown.totalPagar,
      detalleJson: JSON.stringify(breakdown),
      generadoPorId: session.user.id,
    },
  });

  revalidatePath("/nomina");
}

export async function deletePagoGalpon(id: string) {
  await requireAdmin();
  await prisma.pagoGalpon.delete({ where: { id } });
  revalidatePath("/nomina");
}
