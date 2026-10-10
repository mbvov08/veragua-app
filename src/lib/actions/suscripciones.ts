"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { dateOnlyToUTC, addDays, dayOfWeek } from "@/lib/date";

const DIAS_RECORDATORIO_ANTES = 3;

type ItemInput = { productoId: string; cantidad: string | null };

function parseItems(formData: FormData): ItemInput[] {
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

function sumarUnMes(fecha: Date): Date {
  const d = new Date(fecha);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), 12, 0, 0));
}

async function crearRecordatorioVencimiento(clienteNombre: string, fechaFin: Date, creadoPorId: string) {
  const fechaRecordatorio = addDays(fechaFin, -DIAS_RECORDATORIO_ANTES);
  const rule = await prisma.reminderRule.create({
    data: {
      titulo: `¿${clienteNombre} renueva su suscripción?`,
      mensaje: `La suscripción de ${clienteNombre} vence el ${fechaFin.toISOString().slice(0, 10)}. Escríbele para preguntar si quiere el siguiente mes.`,
      diaSemana: dayOfWeek(fechaRecordatorio),
      activo: true,
      esUnico: true,
      creadoPorId,
    },
  });
  await prisma.reminderInstance.create({ data: { reminderRuleId: rule.id, fecha: fechaRecordatorio } });
  return rule.id;
}

export async function crearSuscripcion(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("No autenticado");

  const clienteNombre = String(formData.get("cliente") ?? "").trim();
  const direccion = String(formData.get("direccion") ?? "").trim();
  const telefono = String(formData.get("telefono") ?? "").trim() || null;
  const zona = String(formData.get("zona") ?? "LOCAL");
  const diaSemana = Number(formData.get("diaSemana"));
  const fechaInicioStr = String(formData.get("fechaInicio") ?? "");
  const montoPagado = Number(formData.get("montoPagado"));
  const metodoPago = String(formData.get("metodoPago") ?? "").trim() || null;
  const notas = String(formData.get("notas") ?? "").trim() || null;
  const items = parseItems(formData);

  if (!clienteNombre || !direccion || !fechaInicioStr) {
    throw new Error("Completa cliente, dirección y fecha de inicio.");
  }
  if (Number.isNaN(diaSemana)) throw new Error("Selecciona el día de entrega.");
  if (!(montoPagado > 0)) throw new Error("El monto pagado debe ser mayor a cero.");
  if (items.length === 0) throw new Error("Agrega al menos un producto a la suscripción.");

  const fechaInicio = dateOnlyToUTC(fechaInicioStr);
  const fechaFin = sumarUnMes(fechaInicio);

  const cliente = await prisma.cliente.upsert({
    where: { nombre: clienteNombre },
    update: { direccion, telefono, zona },
    create: { nombre: clienteNombre, direccion, telefono, zona },
  });

  const rule = await prisma.recurringOrderRule.create({
    data: {
      cliente: clienteNombre,
      direccion,
      telefono,
      zona,
      diaSemana,
      notas,
      fechaFin,
      creadoPorId: session.user.id,
    },
  });

  await prisma.recurringOrderRuleItem.createMany({
    data: items.map((it) => ({ recurringRuleId: rule.id, productoId: it.productoId, cantidad: it.cantidad })),
  });

  const categoria = await prisma.finCategory.findFirstOrThrow({ where: { codigo: "4136" } });
  await prisma.finTransaction.create({
    data: {
      company: "VERAGUA",
      tipo: "income",
      fecha: fechaInicio,
      monto: montoPagado,
      categoriaId: categoria.id,
      metodoPago,
      descripcion: `Suscripción ${clienteNombre} (${fechaInicio.toISOString().slice(0, 10)} a ${fechaFin.toISOString().slice(0, 10)})`,
      contraparte: clienteNombre,
      creadoPorId: session.user.id,
    },
  });

  const reminderRuleId = await crearRecordatorioVencimiento(clienteNombre, fechaFin, session.user.id);

  await prisma.suscripcion.create({
    data: {
      company: "VERAGUA",
      clienteId: cliente.id,
      recurringRuleId: rule.id,
      fechaInicio,
      fechaFin,
      montoPagado,
      metodoPago,
      reminderRuleId,
      creadoPorId: session.user.id,
    },
  });

  revalidatePath("/pedidos/suscripciones");
  revalidatePath("/pedidos");
  revalidatePath("/calendario");
  revalidatePath("/");
  revalidatePath("/finanzas");
}

export async function renovarSuscripcion(suscripcionId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("No autenticado");

  const anterior = await prisma.suscripcion.findUniqueOrThrow({
    where: { id: suscripcionId },
    include: { cliente: true, recurringRule: true },
  });

  const fechaInicioStr = String(formData.get("fechaInicio") ?? "");
  const montoPagado = Number(formData.get("montoPagado"));
  const metodoPago = String(formData.get("metodoPago") ?? "").trim() || null;
  if (!fechaInicioStr) throw new Error("La fecha de inicio es obligatoria.");
  if (!(montoPagado > 0)) throw new Error("El monto pagado debe ser mayor a cero.");

  const fechaInicio = dateOnlyToUTC(fechaInicioStr);
  const fechaFin = sumarUnMes(fechaInicio);

  await prisma.recurringOrderRule.update({
    where: { id: anterior.recurringRuleId },
    data: { fechaFin, activo: true },
  });

  const categoria = await prisma.finCategory.findFirstOrThrow({ where: { codigo: "4136" } });
  await prisma.finTransaction.create({
    data: {
      company: "VERAGUA",
      tipo: "income",
      fecha: fechaInicio,
      monto: montoPagado,
      categoriaId: categoria.id,
      metodoPago,
      descripcion: `Renovación suscripción ${anterior.cliente.nombre} (${fechaInicio.toISOString().slice(0, 10)} a ${fechaFin.toISOString().slice(0, 10)})`,
      contraparte: anterior.cliente.nombre,
      creadoPorId: session.user.id,
    },
  });

  const reminderRuleId = await crearRecordatorioVencimiento(anterior.cliente.nombre, fechaFin, session.user.id);

  await prisma.suscripcion.create({
    data: {
      company: "VERAGUA",
      clienteId: anterior.clienteId,
      recurringRuleId: anterior.recurringRuleId,
      fechaInicio,
      fechaFin,
      montoPagado,
      metodoPago,
      reminderRuleId,
      creadoPorId: session.user.id,
    },
  });

  revalidatePath("/pedidos/suscripciones");
  revalidatePath("/calendario");
  revalidatePath("/");
  revalidatePath("/finanzas");
}

export async function cancelarSuscripcion(suscripcionId: string) {
  await auth();
  const suscripcion = await prisma.suscripcion.findUniqueOrThrow({ where: { id: suscripcionId } });
  await prisma.recurringOrderRule.update({ where: { id: suscripcion.recurringRuleId }, data: { activo: false } });
  await prisma.suscripcion.update({ where: { id: suscripcionId }, data: { estado: "cancelada" } });
  revalidatePath("/pedidos/suscripciones");
  revalidatePath("/pedidos");
}

function normalizarNombre(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

/** Crea una suscripción a partir de la calculadora: los productos y cantidades por semana
 * ya vienen calculados, y se elige si el pago ya entró (ingreso en Suscripciones) o queda
 * pendiente (cuenta por cobrar que, al cobrarse, también se clasifica como Suscripciones). */
export async function crearSuscripcionDesdeCalculadora(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("No autenticado");

  const clienteNombre = String(formData.get("cliente") ?? "").trim();
  const direccion = String(formData.get("direccion") ?? "").trim();
  const telefono = String(formData.get("telefono") ?? "").trim() || null;
  const zona = String(formData.get("zona") ?? "LOCAL");
  const diaSemana = Number(formData.get("diaSemana"));
  const fechaInicioStr = String(formData.get("fechaInicio") ?? "");
  const entregas = Math.max(1, Math.round(Number(formData.get("entregas")) || 0));
  const domicilio = Number(formData.get("domicilio")) || 0;
  const monto = Math.round(Number(formData.get("monto")));
  const estado = String(formData.get("estado") ?? "pagada");
  const metodoPago = String(formData.get("metodoPago") ?? "").trim() || null;
  const observaciones = String(formData.get("observaciones") ?? "").trim();
  const resumen = String(formData.get("resumen") ?? "").trim();

  let items: { nombre: string; cantidad: number }[] = [];
  try {
    items = JSON.parse(String(formData.get("itemsJson") ?? "[]"));
  } catch {
    items = [];
  }
  items = items.filter((i) => i && typeof i.nombre === "string" && Number(i.cantidad) > 0);

  if (!clienteNombre || !direccion || !fechaInicioStr) throw new Error("Completa cliente, dirección y fecha de inicio.");
  if (Number.isNaN(diaSemana)) throw new Error("Selecciona el día de entrega.");
  if (!(monto > 0)) throw new Error("El valor de la suscripción debe ser mayor a cero.");
  if (items.length === 0) throw new Error("Agrega al menos un producto a la calculadora.");
  if (estado !== "pagada" && estado !== "pendiente") throw new Error("Estado de pago inválido.");

  // Los productos de la calculadora son los de Inventario; los pedidos usan el catálogo de
  // Pedidos, que comparte los mismos nombres.
  const catalogo = await prisma.producto.findMany();
  const porNombre = new Map(catalogo.map((p) => [normalizarNombre(p.nombre), p.id]));
  const sinCatalogo = items.filter((i) => !porNombre.has(normalizarNombre(i.nombre))).map((i) => i.nombre);
  if (sinCatalogo.length > 0) throw new Error(`Estos productos no están en el catálogo de Pedidos: ${sinCatalogo.join(", ")}.`);
  const domicilioId = domicilio > 0 ? porNombre.get("domicilio") : undefined;

  // Primera entrega: el primer día elegido desde la fecha de inicio; la última, N-1 semanas después.
  const fechaInicio = dateOnlyToUTC(fechaInicioStr);
  const primera = addDays(fechaInicio, (diaSemana - dayOfWeek(fechaInicio) + 7) % 7);
  const fechaFin = addDays(primera, (entregas - 1) * 7);

  const cliente = await prisma.cliente.upsert({
    where: { nombre: clienteNombre },
    update: { direccion, telefono, zona },
    create: { nombre: clienteNombre, direccion, telefono, zona },
  });

  const rule = await prisma.recurringOrderRule.create({
    data: {
      cliente: clienteNombre,
      direccion,
      telefono,
      zona,
      diaSemana,
      notas: observaciones || null,
      fechaFin,
      creadoPorId: session.user.id,
    },
  });
  await prisma.recurringOrderRuleItem.createMany({
    data: [
      ...items.map((i) => ({ recurringRuleId: rule.id, productoId: porNombre.get(normalizarNombre(i.nombre))!, cantidad: String(i.cantidad) })),
      ...(domicilioId ? [{ recurringRuleId: rule.id, productoId: domicilioId, cantidad: "1" }] : []),
    ],
  });

  const categoria = await prisma.finCategory.findFirstOrThrow({ where: { codigo: "4136" } });
  const periodo = `${fechaInicio.toISOString().slice(0, 10)} a ${fechaFin.toISOString().slice(0, 10)}`;
  if (estado === "pagada") {
    await prisma.finTransaction.create({
      data: {
        company: "VERAGUA",
        tipo: "income",
        fecha: fechaInicio,
        monto,
        categoriaId: categoria.id,
        metodoPago,
        descripcion: `Suscripción ${clienteNombre} (${periodo})`,
        contraparte: clienteNombre,
        creadoPorId: session.user.id,
      },
    });
  } else {
    await prisma.finCuentaPorCobrar.create({
      data: {
        company: "VERAGUA",
        clienteId: cliente.id,
        fecha: fechaInicio,
        montoTotal: monto,
        saldo: monto,
        categoriaId: categoria.id,
        creadoPorId: session.user.id,
        notas: `Suscripción (${periodo}${resumen ? `: ${resumen}` : ""}). Pendiente de pago${metodoPago ? ` en ${metodoPago.toLowerCase()}` : ""}.`,
      },
    });
  }

  const reminderRuleId = await crearRecordatorioVencimiento(clienteNombre, fechaFin, session.user.id);
  await prisma.suscripcion.create({
    data: {
      company: "VERAGUA",
      clienteId: cliente.id,
      recurringRuleId: rule.id,
      fechaInicio,
      fechaFin,
      montoPagado: monto,
      metodoPago,
      reminderRuleId,
      creadoPorId: session.user.id,
    },
  });

  revalidatePath("/pedidos/suscripciones");
  revalidatePath("/pedidos");
  revalidatePath("/calendario");
  revalidatePath("/");
  revalidatePath("/finanzas");
  revalidatePath("/inventario/cuentas-por-cobrar");
}
