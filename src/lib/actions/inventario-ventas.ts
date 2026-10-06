"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { dateOnlyToUTC } from "@/lib/date";
import { requireFinanzas } from "@/lib/actions/finanzas";
import { parseCompany, parseSaleItems, findDefaultCategory, registrarComisionBoldSiAplica } from "@/lib/inventario/shared";
import { repartirPagoCliente, aplicarCreditoDisponibleCliente } from "@/lib/inventario/credito";

function revalidateVentas() {
  revalidatePath("/inventario");
  revalidatePath("/inventario/ventas");
  revalidatePath("/inventario/clientes");
  revalidatePath("/inventario/cuentas-por-cobrar");
}

/** Mismo patrón que upsertCliente() en lib/actions/orders.ts: solo nombre es obligatorio aquí. */
async function upsertClienteMinimo(nombre: string) {
  return prisma.cliente.upsert({
    where: { nombre },
    update: {},
    create: { nombre, direccion: "", zona: "LOCAL" },
  });
}

export async function registrarVenta(formData: FormData) {
  const session = await requireFinanzas();

  const company = parseCompany(formData.get("company"));
  const clienteNombre = String(formData.get("clienteNombre") ?? "").trim();
  const canalId = String(formData.get("canalId") ?? "") || null;
  const fechaStr = String(formData.get("fecha") ?? "");
  const estado = String(formData.get("estado") ?? "pagada");
  const metodoPago = String(formData.get("metodoPago") ?? "").trim() || null;
  const notas = String(formData.get("notas") ?? "").trim() || null;
  const items = parseSaleItems(formData);

  if (!fechaStr) throw new Error("La fecha es obligatoria.");
  if (estado !== "pagada" && estado !== "pendiente") throw new Error("Estado inválido.");
  if (items.length === 0) throw new Error("Agrega al menos un producto a la venta.");
  if (estado === "pendiente" && !clienteNombre) {
    throw new Error("Una venta fiada necesita un cliente.");
  }

  const fecha = dateOnlyToUTC(fechaStr);
  const total = items.reduce((sum, it) => sum + it.cantidad * it.precioUnitario, 0);

  await prisma.$transaction(async (tx) => {
    let clienteId: string | null = null;
    if (clienteNombre) {
      const cliente = await upsertClienteMinimo(clienteNombre);
      clienteId = cliente.id;
    }

    let finTransactionId: string | null = null;
    if (estado === "pagada") {
      const categoria = await findDefaultCategory(company, "4135");
      const transaction = await tx.finTransaction.create({
        data: {
          company,
          tipo: "income",
          fecha,
          monto: total,
          categoriaId: categoria.id,
          canalId,
          metodoPago,
          contraparte: clienteNombre || null,
          descripcion: "Venta de inventario",
          fuente: "manual",
          creadoPorId: session.user.id,
        },
      });
      finTransactionId = transaction.id;
      await registrarComisionBoldSiAplica(tx, { company, fecha, metodoPago, montoVenta: total, canalId, creadoPorId: session.user.id });
    }

    const sale = await tx.finSale.create({
      data: {
        company,
        clienteId,
        canalId,
        fecha,
        estado,
        total,
        notas,
        finTransactionId,
        creadoPorId: session.user.id,
        items: { create: items.map((it) => ({ productoId: it.productoId, cantidad: it.cantidad, precioUnitario: it.precioUnitario })) },
      },
    });

    if (estado === "pendiente" && clienteId) {
      const cuenta = await tx.finCuentaPorCobrar.create({
        data: {
          company,
          clienteId,
          ventaId: sale.id,
          fecha,
          montoTotal: total,
          saldo: total,
          creadoPorId: session.user.id,
        },
      });
      await aplicarCreditoDisponibleCliente(tx, cuenta.id, clienteId);
    }
  }, { maxWait: 10000, timeout: 20000 });

  revalidateVentas();
  revalidatePath("/finanzas");
  revalidatePath("/finanzas/movimientos");
  revalidatePath("/finanzas/pyg");
  revalidatePath("/finanzas/canales");
}

export async function registrarPagoCliente(formData: FormData) {
  const session = await requireFinanzas();

  const clienteId = String(formData.get("clienteId") ?? "");
  const company = parseCompany(formData.get("company"));
  const monto = Number(formData.get("monto"));
  const fechaStr = String(formData.get("fecha") ?? "");
  const metodoPago = String(formData.get("metodoPago") ?? "").trim() || null;
  const notas = String(formData.get("notas") ?? "").trim() || null;

  if (!clienteId) throw new Error("Selecciona un cliente.");
  if (!fechaStr) throw new Error("La fecha es obligatoria.");
  if (!(monto > 0)) throw new Error("El monto debe ser mayor a cero.");

  const fecha = dateOnlyToUTC(fechaStr);

  await prisma.$transaction(async (tx) => {
    const categoria = await findDefaultCategory(company, "4135");
    const cliente = await tx.cliente.findUniqueOrThrow({ where: { id: clienteId } });

    const transaction = await tx.finTransaction.create({
      data: {
        company,
        tipo: "income",
        fecha,
        monto,
        categoriaId: categoria.id,
        contraparte: cliente.nombre,
        metodoPago,
        descripcion: "Pago de cliente",
        fuente: "manual",
        creadoPorId: session.user.id,
      },
    });

    const pago = await tx.finPagoCliente.create({
      data: {
        clienteId,
        monto,
        fecha,
        metodoPago,
        notas,
        finTransactionId: transaction.id,
        creadoPorId: session.user.id,
      },
    });

    await repartirPagoCliente(tx, pago.id, clienteId, monto);
  }, { maxWait: 10000, timeout: 20000 });

  revalidateVentas();
  revalidatePath("/finanzas");
  revalidatePath("/finanzas/movimientos");
  revalidatePath("/finanzas/pyg");
  revalidatePath("/finanzas/canales");
}

export async function crearCliente(formData: FormData) {
  await requireFinanzas();
  const nombre = String(formData.get("nombre") ?? "").trim();
  const telefono = String(formData.get("telefono") ?? "").trim() || null;
  const direccion = String(formData.get("direccion") ?? "").trim();
  const zona = String(formData.get("zona") ?? "LOCAL");
  if (!nombre) throw new Error("El nombre del cliente es obligatorio.");

  const existing = await prisma.cliente.findUnique({ where: { nombre } });
  if (existing) throw new Error("Ya existe un cliente con ese nombre.");

  await prisma.cliente.create({ data: { nombre, telefono, direccion, zona } });
  revalidateVentas();
}

export async function editarCliente(clienteId: string, formData: FormData) {
  await requireFinanzas();
  const nombre = String(formData.get("nombre") ?? "").trim();
  const telefono = String(formData.get("telefono") ?? "").trim() || null;
  const direccion = String(formData.get("direccion") ?? "").trim();
  const zona = String(formData.get("zona") ?? "LOCAL");
  if (!nombre) throw new Error("El nombre del cliente es obligatorio.");

  const existing = await prisma.cliente.findUnique({ where: { nombre } });
  if (existing && existing.id !== clienteId) throw new Error("Ya existe otro cliente con ese nombre.");

  await prisma.cliente.update({ where: { id: clienteId }, data: { nombre, telefono, direccion, zona } });
  revalidateVentas();
}
