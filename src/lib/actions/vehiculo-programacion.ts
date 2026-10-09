"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { dateOnlyToUTC, todayColombia } from "@/lib/date";
import { requireVehiculoAccess, requireVehiculoStaff } from "@/lib/vehiculo/access";

/** Próximas rutas programadas para un conductor (incluye hoy) — lo que ve en su propio
 * inicio para saber con anticipación qué días lo van a necesitar, y lo que se usa en el
 * acta de entrega para elegir cuál se está abriendo. */
export async function listarProximasRutasDe(conductorId: string) {
  const session = await requireVehiculoAccess();
  const isStaff = session.user.role === "ADMIN" || session.user.role === "EMPLEADA";
  if (!isStaff && session.user.id !== conductorId) {
    throw new Error("No tienes acceso a la programación de otro conductor.");
  }
  const hoy = todayColombia();
  return prisma.vehiculoRutaProgramada.findMany({
    where: { conductorId, fecha: { gte: hoy } },
    orderBy: { fecha: "asc" },
  });
}

/** Para la pantalla de staff: todas las próximas rutas programadas de todos los
 * conductores, para armar/revisar el calendario de la semana. */
export async function listarProximasRutasProgramadas() {
  await requireVehiculoAccess();
  const hoy = todayColombia();
  return prisma.vehiculoRutaProgramada.findMany({
    where: { fecha: { gte: hoy } },
    include: { conductor: true },
    orderBy: { fecha: "asc" },
  });
}

export async function programarRuta(formData: FormData) {
  const session = await requireVehiculoStaff();

  const conductorId = String(formData.get("conductorId") ?? "");
  const fechaStr = String(formData.get("fecha") ?? "");
  const notas = String(formData.get("notas") ?? "").trim() || null;
  if (!conductorId || !fechaStr) throw new Error("Falta el conductor o la fecha.");

  const fecha = dateOnlyToUTC(fechaStr);

  await prisma.vehiculoRutaProgramada.upsert({
    where: { conductorId_fecha: { conductorId, fecha } },
    update: { notas, creadoPorId: session.user.id },
    create: { conductorId, fecha, notas, creadoPorId: session.user.id },
  });

  revalidatePath("/vehiculo");
  revalidatePath("/");
  revalidatePath("/calendario");
}

export async function eliminarRutaProgramada(id: string) {
  await requireVehiculoStaff();
  await prisma.vehiculoRutaProgramada.delete({ where: { id } });
  revalidatePath("/vehiculo");
  revalidatePath("/");
  revalidatePath("/calendario");
}
