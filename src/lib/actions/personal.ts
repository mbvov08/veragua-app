"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { colombiaDateTime, dateOnlyToUTC, workDateFor } from "@/lib/date";
import { finJornadaOrdinaria } from "@/lib/schedule";

export async function clockIn() {
  const session = await auth();
  if (!session?.user) throw new Error("No autenticado");

  const now = new Date();
  const workDate = workDateFor(now);

  const existing = await prisma.timeEntry.findUnique({
    where: { userId_workDate: { userId: session.user.id, workDate } },
  });
  if (existing) throw new Error("Ya registraste tu entrada de hoy.");

  await prisma.timeEntry.create({
    data: { userId: session.user.id, workDate, clockIn: now },
  });

  revalidatePath("/");
  revalidatePath("/personal");
}

export async function clockOut(
  motivoSalidaTardia?: string,
  justificacionSalida?: string,
  esJustificable?: boolean
) {
  const session = await auth();
  if (!session?.user) throw new Error("No autenticado");

  const now = new Date();
  const workDate = workDateFor(now);

  const existing = await prisma.timeEntry.findUnique({
    where: { userId_workDate: { userId: session.user.id, workDate } },
  });
  if (!existing) throw new Error("Primero debes registrar tu entrada.");
  if (existing.clockOut) throw new Error("Ya registraste tu salida de hoy.");

  const finOrdinario = finJornadaOrdinaria(workDate);
  const esTardia = finOrdinario !== null && now > finOrdinario;
  if (esTardia && (!motivoSalidaTardia || !justificacionSalida?.trim() || esJustificable === undefined)) {
    throw new Error("Como saliste después de tu horario, indica el motivo, la justificación y si crees que es justificable.");
  }

  await prisma.timeEntry.update({
    where: { id: existing.id },
    data: {
      clockOut: now,
      motivoSalidaTardia: esTardia ? motivoSalidaTardia : null,
      justificacionSalida: esTardia ? justificacionSalida?.trim() : null,
      esJustificable: esTardia ? esJustificable : null,
    },
  });

  revalidatePath("/");
  revalidatePath("/personal");
}

/** Solo la administradora corrige o agrega un registro (ej. si a alguien se le olvidó marcar). */
export async function adminSetTimeEntry(formData: FormData) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Solo la administradora puede corregir registros de horario.");
  }

  const userId = String(formData.get("userId") ?? "");
  const fechaStr = String(formData.get("fecha") ?? "");
  const horaEntrada = String(formData.get("horaEntrada") ?? "");
  const horaSalida = String(formData.get("horaSalida") ?? "");
  if (!userId || !fechaStr || !horaEntrada) {
    throw new Error("Completa la persona, la fecha y la hora de entrada.");
  }

  const workDate = dateOnlyToUTC(fechaStr);
  const clockIn = colombiaDateTime(fechaStr, horaEntrada);
  const clockOut = horaSalida ? colombiaDateTime(fechaStr, horaSalida) : null;

  await prisma.timeEntry.upsert({
    where: { userId_workDate: { userId, workDate } },
    update: { clockIn, clockOut, motivoSalidaTardia: null, justificacionSalida: null },
    create: { userId, workDate, clockIn, clockOut },
  });

  revalidatePath("/personal/historial");
  revalidatePath("/personal");
  revalidatePath("/");
}

export async function adminDeleteTimeEntry(id: string) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Solo la administradora puede eliminar registros de horario.");
  }
  await prisma.timeEntry.delete({ where: { id } });
  revalidatePath("/personal/historial");
}
