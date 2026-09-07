"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { dateOnlyToUTC } from "@/lib/date";
import { computeQuincena, computeLiquidacion } from "@/lib/payroll";

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

  await prisma.payrollSettings.upsert({
    where: { id: "singleton" },
    update: { smlmv, auxilioTransporte, porcentajeSalud, porcentajePension, horasSemanaLegal },
    create: {
      id: "singleton",
      smlmv,
      auxilioTransporte,
      porcentajeSalud,
      porcentajePension,
      horasSemanaLegal,
    },
  });

  revalidatePath("/nomina/ajustes");
}

export async function updateEmployeeProfile(formData: FormData) {
  await requireAdmin();

  const userId = String(formData.get("userId") ?? "");
  const salarioBase = Number(formData.get("salarioBase"));
  const fechaIngresoStr = String(formData.get("fechaIngreso") ?? "");
  const auxTransporte = formData.get("auxTransporte") === "on";
  if (!userId || !fechaIngresoStr) throw new Error("Datos inválidos");

  await prisma.employeeProfile.upsert({
    where: { userId },
    update: { salarioBase, fechaIngreso: dateOnlyToUTC(fechaIngresoStr), auxTransporte },
    create: { userId, salarioBase, fechaIngreso: dateOnlyToUTC(fechaIngresoStr), auxTransporte },
  });

  revalidatePath("/nomina/ajustes");
}

export async function generatePayrollSlip(formData: FormData) {
  const session = await requireAdmin();

  const userId = String(formData.get("userId") ?? "");
  const periodStart = dateOnlyToUTC(String(formData.get("periodStart") ?? ""));
  const periodEnd = dateOnlyToUTC(String(formData.get("periodEnd") ?? ""));

  const breakdown = await computeQuincena(userId, periodStart, periodEnd);

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
      valorExtraDiu: breakdown.valorExtraDiu,
      valorExtraNoc: breakdown.valorExtraNoc,
      auxTransporte: breakdown.auxTransporte,
      totalDevengado: breakdown.totalDevengado,
      saludDeduccion: breakdown.saludDeduccion,
      pensionDeduccion: breakdown.pensionDeduccion,
      totalDeducciones: breakdown.totalDeducciones,
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
