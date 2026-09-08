"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { dateOnlyToUTC, dayOfWeek } from "@/lib/date";

type OrderItemInput = { productoId: string; cantidad: string | null };

function parseItems(formData: FormData): OrderItemInput[] {
  const raw = String(formData.get("itemsJson") ?? "[]");
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((it) => it && typeof it.productoId === "string" && it.productoId)
      .map((it) => ({ productoId: it.productoId, cantidad: it.cantidad ? String(it.cantidad).trim() || null : null }));
  } catch {
    return [];
  }
}

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
  const items = parseItems(formData);

  if (!cliente || !direccion || !fechaStr) {
    throw new Error("Completa cliente, dirección y fecha de entrega.");
  }

  const fechaEntrega = dateOnlyToUTC(fechaStr);

  let recurringRuleId: string | null = null;
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
    recurringRuleId = rule.id;
  }

  const order = await prisma.order.create({
    data: {
      cliente,
      direccion,
      telefono,
      zona,
      fechaEntrega,
      notas: notas || null,
      recurringRuleId,
      creadoPorId: session.user.id,
    },
  });

  if (items.length > 0) {
    await prisma.orderItem.createMany({
      data: items.map((it) => ({ orderId: order.id, productoId: it.productoId, cantidad: it.cantidad })),
    });
  }

  revalidatePath("/pedidos");
  revalidatePath("/pedidos/pereira");
  revalidatePath("/calendario");
  revalidatePath("/");
}

export async function updateOrder(orderId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("No autenticado");

  const cliente = String(formData.get("cliente") ?? "").trim();
  const direccion = String(formData.get("direccion") ?? "").trim();
  const telefono = String(formData.get("telefono") ?? "").trim() || null;
  const zona = String(formData.get("zona") ?? "LOCAL");
  const fechaStr = String(formData.get("fechaEntrega") ?? "");
  const notas = String(formData.get("notas") ?? "").trim();
  const items = parseItems(formData);

  if (!cliente || !direccion || !fechaStr) {
    throw new Error("Completa cliente, dirección y fecha de entrega.");
  }

  await prisma.order.update({
    where: { id: orderId },
    data: {
      cliente,
      direccion,
      telefono,
      zona,
      fechaEntrega: dateOnlyToUTC(fechaStr),
      notas: notas || null,
    },
  });

  await prisma.orderItem.deleteMany({ where: { orderId } });
  if (items.length > 0) {
    await prisma.orderItem.createMany({
      data: items.map((it) => ({ orderId, productoId: it.productoId, cantidad: it.cantidad })),
    });
  }

  revalidatePath("/pedidos");
  revalidatePath("/pedidos/pereira");
  revalidatePath("/calendario");
  revalidatePath("/");
}

export async function guardarRutaDia(formData: FormData) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Solo la administradora puede configurar los días de ruta.");
  }

  const zona = String(formData.get("zona") ?? "");
  const diaSemana = Number(formData.get("diaSemana"));
  if (!["PEREIRA", "MANIZALES"].includes(zona) || Number.isNaN(diaSemana)) {
    throw new Error("Elige la zona y el día correctos.");
  }

  await prisma.rutaSettings.upsert({
    where: { zona },
    update: { diaSemana },
    create: { zona, diaSemana },
  });

  revalidatePath("/pedidos");
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

  await prisma.orderItem.deleteMany({ where: { orderId } });
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

  const pendientes = await prisma.order.findMany({
    where: { recurringRuleId: ruleId, entregado: false },
    select: { id: true },
  });
  await prisma.orderItem.deleteMany({ where: { orderId: { in: pendientes.map((o) => o.id) } } });
  await prisma.order.deleteMany({ where: { recurringRuleId: ruleId, entregado: false } });
  await prisma.recurringOrderRule.update({ where: { id: ruleId }, data: { activo: false } });
  revalidatePath("/pedidos");
  revalidatePath("/calendario");
}
