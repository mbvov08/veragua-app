"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { dateOnlyToUTC } from "@/lib/date";

export async function createReminderRule(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("No autenticado");

  const titulo = String(formData.get("titulo") ?? "").trim();
  const mensaje = String(formData.get("mensaje") ?? "").trim();
  const diaSemana = Number(formData.get("diaSemana"));
  if (!titulo || Number.isNaN(diaSemana)) throw new Error("Datos inválidos");

  await prisma.reminderRule.create({
    data: {
      titulo,
      mensaje: mensaje || null,
      diaSemana,
      creadoPorId: session.user.id,
    },
  });

  revalidatePath("/recordatorios");
  revalidatePath("/calendario");
  revalidatePath("/");
}

export async function toggleReminderRule(id: string, activo: boolean) {
  const session = await auth();
  if (!session?.user) throw new Error("No autenticado");

  await prisma.reminderRule.update({ where: { id }, data: { activo } });
  revalidatePath("/recordatorios");
  revalidatePath("/");
}

export async function deleteReminderRule(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("No autenticado");

  await prisma.reminderInstance.deleteMany({ where: { reminderRuleId: id } });
  await prisma.reminderRule.delete({ where: { id } });
  revalidatePath("/recordatorios");
  revalidatePath("/");
}

export async function dismissReminderInstance(instanceId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("No autenticado");

  await prisma.reminderDismissal.upsert({
    where: {
      reminderInstanceId_userId: {
        reminderInstanceId: instanceId,
        userId: session.user.id,
      },
    },
    update: {},
    create: { reminderInstanceId: instanceId, userId: session.user.id },
  });

  revalidatePath("/");
  revalidatePath("/calendario");
}

export async function createOneOffReminderForDate(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("No autenticado");

  const titulo = String(formData.get("titulo") ?? "").trim();
  const mensaje = String(formData.get("mensaje") ?? "").trim();
  const fechaStr = String(formData.get("fecha") ?? "");
  if (!titulo || !fechaStr) throw new Error("Datos inválidos");

  const fecha = dateOnlyToUTC(fechaStr);
  const rule = await prisma.reminderRule.create({
    data: {
      titulo,
      mensaje: mensaje || null,
      diaSemana: fecha.getUTCDay(),
      activo: false, // no se repite: se desactiva tras crear la única instancia
      creadoPorId: session.user.id,
    },
  });
  await prisma.reminderInstance.create({ data: { reminderRuleId: rule.id, fecha } });

  revalidatePath("/recordatorios");
  revalidatePath("/calendario");
  revalidatePath("/");
}
