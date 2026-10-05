"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { dateOnlyToUTC } from "@/lib/date";
import { COMPANIES, type Company } from "@/lib/finanzas/queries";
import { parseSaleItems, findDefaultCategory } from "@/lib/inventario/shared";
import { aplicarCreditoDisponibleCliente } from "@/lib/inventario/credito";

export async function requireFinanzas() {
  const session = await auth();
  if (!session?.user || !(session.user.role === "ADMIN" || session.user.puedeVerFinanzas)) {
    throw new Error("No tienes acceso al módulo de Finanzas.");
  }
  return session;
}

function revalidateFinanzas() {
  revalidatePath("/finanzas");
  revalidatePath("/finanzas/movimientos");
  revalidatePath("/finanzas/pyg");
  revalidatePath("/finanzas/canales");
}

function parseCompany(value: FormDataEntryValue | null): Company {
  const v = String(value ?? "");
  if (!COMPANIES.includes(v as Company)) throw new Error("Selecciona una empresa válida.");
  return v as Company;
}

/** Registra una venta con productos de inventario, llegada desde el formulario genérico de
 * Finanzas (kind=venta). Misma lógica que registrarVenta() en inventario-ventas.ts: crea
 * FinSale + FinSaleItem (descuenta stock), y si ya está pagada, también el FinTransaction. */
async function createTransactionConProductos(
  session: Awaited<ReturnType<typeof requireFinanzas>>,
  formData: FormData,
  company: Company,
  canalId: string | null,
  fecha: Date,
  contraparte: string | null
) {
  const estado = String(formData.get("estado") ?? "pagada");
  const notas = String(formData.get("descripcion") ?? "").trim() || null;
  const items = parseSaleItems(formData);

  if (estado !== "pagada" && estado !== "pendiente") throw new Error("Estado inválido.");
  if (estado === "pendiente" && !contraparte) throw new Error("Una venta fiada necesita un cliente.");

  const total = items.reduce((sum, it) => sum + it.cantidad * it.precioUnitario, 0);

  await prisma.$transaction(async (tx) => {
    let clienteId: string | null = null;
    if (contraparte) {
      const cliente = await tx.cliente.upsert({
        where: { nombre: contraparte },
        update: {},
        create: { nombre: contraparte, direccion: "", zona: "LOCAL" },
      });
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
          contraparte,
          descripcion: "Venta de inventario",
          fuente: "manual",
          creadoPorId: session.user.id,
        },
      });
      finTransactionId = transaction.id;
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

  revalidatePath("/inventario");
  revalidatePath("/inventario/ventas");
  revalidatePath("/inventario/clientes");
  revalidateFinanzas();
}

export async function createTransaction(formData: FormData) {
  const session = await requireFinanzas();

  const company = parseCompany(formData.get("company"));
  const tipo = String(formData.get("tipo") ?? "");
  const fechaStr = String(formData.get("fecha") ?? "");
  const monto = Number(formData.get("monto"));
  const categoriaId = String(formData.get("categoriaId") ?? "");
  const canalId = String(formData.get("canalId") ?? "") || null;
  const metodoPago = String(formData.get("metodoPago") ?? "").trim() || null;
  const descripcion = String(formData.get("descripcion") ?? "").trim() || null;
  const contraparte = String(formData.get("contraparte") ?? "").trim() || null;
  const esCompartido = formData.get("esCompartido") === "on";

  if (tipo !== "income" && tipo !== "expense") throw new Error("Tipo inválido.");
  if (!fechaStr) throw new Error("La fecha es obligatoria.");

  const items = parseSaleItems(formData);
  if (tipo === "income" && items.length > 0) {
    await createTransactionConProductos(session, formData, company, canalId, dateOnlyToUTC(fechaStr), contraparte);
    return;
  }

  if (!(monto > 0)) throw new Error("El monto debe ser mayor a cero.");
  if (!categoriaId) throw new Error("Selecciona una categoría.");

  if (esCompartido) {
    const categoria = await prisma.finCategory.findUniqueOrThrow({ where: { id: categoriaId } });
    if (categoria.tipo !== "gasto_admin") {
      throw new Error("Solo los gastos administrativos fijos se pueden marcar como compartidos.");
    }
  }

  await prisma.finTransaction.create({
    data: {
      // Un gasto compartido se ancla a VERAGUA sin importar qué empresa se seleccionó en
      // el formulario — el reparto real lo calcula el PyG según las ventas de cada mes.
      company: esCompartido ? "VERAGUA" : company,
      tipo,
      fecha: dateOnlyToUTC(fechaStr),
      monto,
      categoriaId,
      canalId: esCompartido ? null : canalId,
      metodoPago,
      descripcion,
      contraparte,
      esCompartido,
      fuente: "manual",
      creadoPorId: session.user.id,
    },
  });

  revalidateFinanzas();
}

export async function updateTransaction(transactionId: string, formData: FormData) {
  await requireFinanzas();

  const tipo = String(formData.get("tipo") ?? "");
  const fechaStr = String(formData.get("fecha") ?? "");
  const monto = Number(formData.get("monto"));
  const categoriaId = String(formData.get("categoriaId") ?? "");
  const canalId = String(formData.get("canalId") ?? "") || null;
  const metodoPago = String(formData.get("metodoPago") ?? "").trim() || null;
  const descripcion = String(formData.get("descripcion") ?? "").trim() || null;
  const contraparte = String(formData.get("contraparte") ?? "").trim() || null;

  if (tipo !== "income" && tipo !== "expense") throw new Error("Tipo inválido.");
  if (!fechaStr) throw new Error("La fecha es obligatoria.");
  if (!(monto > 0)) throw new Error("El monto debe ser mayor a cero.");
  if (!categoriaId) throw new Error("Selecciona una categoría.");

  await prisma.finTransaction.update({
    where: { id: transactionId },
    data: {
      tipo,
      fecha: dateOnlyToUTC(fechaStr),
      monto,
      categoriaId,
      canalId,
      metodoPago,
      descripcion,
      contraparte,
    },
  });

  revalidateFinanzas();
}

export async function voidTransaction(transactionId: string) {
  const session = await requireFinanzas();
  await prisma.finTransaction.update({
    where: { id: transactionId },
    data: { anulado: true, anuladoAt: new Date(), anuladoPorId: session.user.id },
  });
  revalidateFinanzas();
}

export async function createCategory(formData: FormData) {
  const session = await requireFinanzas();

  const company = parseCompany(formData.get("company"));
  const codigo = String(formData.get("codigo") ?? "").trim();
  const nombre = String(formData.get("nombre") ?? "").trim();
  const tipo = String(formData.get("tipo") ?? "");
  const atribuibleACanal = formData.get("atribuibleACanal") === "on";

  if (!codigo || !nombre) throw new Error("Completa código y nombre.");

  await prisma.finCategory.create({
    data: { company, codigo, nombre, tipo, atribuibleACanal, creadoPorId: session.user.id },
  });

  revalidatePath("/finanzas/ajustes/categorias");
}

export async function deleteCategory(categoryId: string) {
  await requireFinanzas();
  await prisma.finCategory.delete({ where: { id: categoryId } });
  revalidatePath("/finanzas/ajustes/categorias");
}

export async function createChannel(formData: FormData) {
  await requireFinanzas();

  const company = parseCompany(formData.get("company"));
  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!nombre) throw new Error("El nombre del canal es obligatorio.");

  await prisma.finChannel.create({ data: { company, nombre } });
  revalidatePath("/finanzas/ajustes/canales");
}

export async function toggleChannelActive(channelId: string, activo: boolean) {
  await requireFinanzas();
  await prisma.finChannel.update({ where: { id: channelId }, data: { activo } });
  revalidatePath("/finanzas/ajustes/canales");
}
