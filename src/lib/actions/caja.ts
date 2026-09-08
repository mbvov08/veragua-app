"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { dateOnlyToUTC, todayColombia } from "@/lib/date";

function requireCajaAccess(role: string) {
  if (role !== "ADMIN" && role !== "EMPLEADA") {
    throw new Error("No autorizado.");
  }
}

export async function updateCajaBase(formData: FormData) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") throw new Error("Solo la administradora puede hacerlo.");

  const baseInicial = Number(formData.get("baseInicial"));
  await prisma.cajaSettings.upsert({
    where: { id: "singleton" },
    update: { baseInicial },
    create: { id: "singleton", baseInicial },
  });

  revalidatePath("/caja");
}

export async function crearEgreso(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("No autenticado");
  requireCajaAccess(session.user.role);

  const monto = Number(formData.get("monto"));
  const categoria = String(formData.get("categoria") ?? "OTROS");
  const observaciones = String(formData.get("observaciones") ?? "").trim() || null;
  const fechaStr = String(formData.get("fecha") ?? "");
  if (!monto || monto <= 0) throw new Error("Ingresa un monto válido.");

  const isAdmin = session.user.role === "ADMIN";

  await prisma.cajaMovimiento.create({
    data: {
      tipo: "EGRESO",
      monto,
      categoria,
      observaciones,
      fecha: fechaStr ? dateOnlyToUTC(fechaStr) : todayColombia(),
      creadoPorId: session.user.id,
      estado: isAdmin ? "APROBADO" : "PENDIENTE",
      aprobadoPorId: isAdmin ? session.user.id : null,
    },
  });

  revalidatePath("/caja");
}

export async function crearIngreso(formData: FormData) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") throw new Error("Solo la administradora puede hacerlo.");

  const monto = Number(formData.get("monto"));
  const observaciones = String(formData.get("observaciones") ?? "").trim() || null;
  const fechaStr = String(formData.get("fecha") ?? "");
  if (!monto || monto <= 0) throw new Error("Ingresa un monto válido.");

  await prisma.cajaMovimiento.create({
    data: {
      tipo: "INGRESO",
      monto,
      observaciones,
      fecha: fechaStr ? dateOnlyToUTC(fechaStr) : todayColombia(),
      creadoPorId: session.user.id,
      estado: "APROBADO",
      aprobadoPorId: session.user.id,
    },
  });

  revalidatePath("/caja");
}

export async function decidirEgreso(id: string, aprobar: boolean) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") throw new Error("Solo la administradora puede aprobar egresos.");

  await prisma.cajaMovimiento.update({
    where: { id },
    data: { estado: aprobar ? "APROBADO" : "RECHAZADO", aprobadoPorId: session.user.id },
  });

  revalidatePath("/caja");
}

export async function eliminarMovimientoCaja(id: string) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") throw new Error("Solo la administradora puede eliminarlo.");

  await prisma.cajaMovimiento.delete({ where: { id } });
  revalidatePath("/caja");
}
