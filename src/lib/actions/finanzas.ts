"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { dateOnlyToUTC } from "@/lib/date";
import { COMPANIES, type Company } from "@/lib/finanzas/queries";

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
  const esIntercompania = formData.get("esIntercompania") === "on";

  if (tipo !== "income" && tipo !== "expense") throw new Error("Tipo inválido.");
  if (!fechaStr) throw new Error("La fecha es obligatoria.");
  if (!(monto > 0)) throw new Error("El monto debe ser mayor a cero.");
  if (!categoriaId) throw new Error("Selecciona una categoría.");

  await prisma.finTransaction.create({
    data: {
      company,
      tipo,
      fecha: dateOnlyToUTC(fechaStr),
      monto,
      categoriaId,
      canalId,
      metodoPago,
      descripcion,
      contraparte,
      esIntercompania,
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
  const esIntercompania = formData.get("esIntercompania") === "on";

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
      esIntercompania,
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
