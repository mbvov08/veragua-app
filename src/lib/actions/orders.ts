"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { dateOnlyToUTC, dayOfWeek } from "@/lib/date";

export async function createOrder(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("No autenticado");

  const cliente = String(formData.get("cliente") ?? "").trim();
  const direccion = String(formData.get("direccion") ?? "").trim();
  const telefono = String(formData.get("telefono") ?? "").trim() || null;
  const zona = String(formData.get("zona") ?? "LOCAL");
  const fechaStr = String(formData.get("fechaEntrega") ?? "");
  const notas = String(formData.get("notas") ?? "").trim();
  const recurrente = formData.get("recurrente") === "on";

  if (!cliente || !direccion || !fechaStr) {
    throw new Error("Completa cliente, dirección y fecha de entrega.");
  }

  const fechaEntrega = dateOnlyToUTC(fechaStr);

  if (recurrente) {
    const rule = await prisma.recurringOrderRule.create({
      data: {
        cliente,
        direccion,
        telefono,
        zona,
        diaSemana: dayOfWeek(fechaEntrega),
        notas: notas || null,
        creadoPorId: session.user.id,
      },
    });
    await prisma.order.create({
      data: {
        cliente,
        direccion,
        telefono,
        zona,
        fechaEntrega,
        notas: notas || null,
        recurringRuleId: rule.id,
        creadoPorId: session.user.id,
      },
    });
  } else {
    await prisma.order.create({
      data: {
        cliente,
        direccion,
        telefono,
        zona,
        fechaEntrega,
        notas: notas || null,
        creadoPorId: session.user.id,
      },
    });
  }

  revalidatePath("/pedidos");
  revalidatePath("/pedidos/pereira");
  revalidatePath("/calendario");
  revalidatePath("/");
}

export async function toggleDelivered(orderId: string, entregado: boolean) {
  const session = await auth();
  if (!session?.user) throw new Error("No autenticado");

  await prisma.order.update({
    where: { id: orderId },
    data: { entregado, entregadoAt: entregado ? new Date() : null },
  });

  revalidatePath("/pedidos");
  revalidatePath("/pedidos/pereira");
  revalidatePath("/calendario");
  revalidatePath("/");
}

export async function deleteOrder(orderId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("No autenticado");

  await prisma.order.delete({ where: { id: orderId } });
  revalidatePath("/pedidos");
  revalidatePath("/pedidos/pereira");
  revalidatePath("/calendario");
}

export async function toggleRecurringRule(ruleId: string, activo: boolean) {
  const session = await auth();
  if (!session?.user) throw new Error("No autenticado");

  await prisma.recurringOrderRule.update({ where: { id: ruleId }, data: { activo } });
  revalidatePath("/pedidos");
}

export async function deleteRecurringRule(ruleId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("No autenticado");

  await prisma.order.deleteMany({ where: { recurringRuleId: ruleId, entregado: false } });
  await prisma.recurringOrderRule.update({ where: { id: ruleId }, data: { activo: false } });
  revalidatePath("/pedidos");
  revalidatePath("/calendario");
}
