"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { dateOnlyToUTC } from "@/lib/date";

export async function registrarGalpon(formData: FormData) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "GALPON" && session.user.role !== "ADMIN")) {
    throw new Error("No autorizado.");
  }

  const fechaStr = String(formData.get("fecha") ?? "");
  const huevosProducidos = Number(formData.get("huevosProducidos"));
  const huevosRotos = Number(formData.get("huevosRotos") ?? 0);
  const observaciones = String(formData.get("observaciones") ?? "").trim() || null;
  if (!fechaStr || Number.isNaN(huevosProducidos)) throw new Error("Completa la fecha y la cantidad producida.");

  const fecha = dateOnlyToUTC(fechaStr);
  const userIdOverride = String(formData.get("userId") ?? "");
  const userId = session.user.role === "ADMIN" && userIdOverride ? userIdOverride : session.user.id;

  await prisma.registroGalpon.upsert({
    where: { userId_fecha: { userId, fecha } },
    update: { huevosProducidos, huevosRotos, observaciones },
    create: { userId, fecha, huevosProducidos, huevosRotos, observaciones },
  });

  revalidatePath("/produccion");
  revalidatePath("/");
}

export async function eliminarRegistroGalpon(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("No autenticado");
  const registro = await prisma.registroGalpon.findUnique({ where: { id } });
  if (!registro) return;
  if (session.user.role !== "ADMIN" && registro.userId !== session.user.id) {
    throw new Error("No autorizado.");
  }
  await prisma.registroGalpon.delete({ where: { id } });
  revalidatePath("/produccion");
}

export async function registrarRecepcionLocal(formData: FormData) {
  const session = await auth();
  if (!session?.user || session.user.role === "GALPON") {
    throw new Error("No autorizado.");
  }

  const fechaStr = String(formData.get("fecha") ?? "");
  const cantidadRecibida = Number(formData.get("cantidadRecibida"));
  const observaciones = String(formData.get("observaciones") ?? "").trim() || null;
  if (!fechaStr || Number.isNaN(cantidadRecibida)) throw new Error("Completa la fecha y la cantidad recibida.");

  const fecha = dateOnlyToUTC(fechaStr);

  await prisma.recepcionLocal.upsert({
    where: { fecha },
    update: { cantidadRecibida, observaciones, registradoPorId: session.user.id },
    create: { fecha, cantidadRecibida, observaciones, registradoPorId: session.user.id },
  });

  revalidatePath("/produccion");
  revalidatePath("/");
}

export async function eliminarRecepcionLocal(id: string) {
  const session = await auth();
  if (!session?.user || session.user.role === "GALPON") {
    throw new Error("No autorizado.");
  }
  await prisma.recepcionLocal.delete({ where: { id } });
  revalidatePath("/produccion");
}
