"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

function categoriaParaRol(role: string): "GALPON" | "LOCAL" | null {
  if (role === "GALPON") return "GALPON";
  if (role === "EMPLEADA") return "LOCAL";
  return null; // admin: decide con el campo del formulario
}

export async function crearItemCompra(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("No autenticado");

  const item = String(formData.get("item") ?? "").trim();
  const cantidad = String(formData.get("cantidad") ?? "").trim() || null;
  const categoriaForzada = categoriaParaRol(session.user.role);
  const categoria = categoriaForzada ?? String(formData.get("categoria") ?? "LOCAL");
  if (!item) throw new Error("Escribe qué hace falta comprar.");

  await prisma.listaCompras.create({
    data: { item, cantidad, categoria, creadoPorId: session.user.id },
  });

  revalidatePath("/compras");
}

export async function marcarComprado(id: string, comprado: boolean) {
  const session = await auth();
  if (!session?.user) throw new Error("No autenticado");

  await prisma.listaCompras.update({
    where: { id },
    data: { comprado, compradoAt: comprado ? new Date() : null },
  });

  revalidatePath("/compras");
}

export async function eliminarItemCompra(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("No autenticado");

  await prisma.listaCompras.delete({ where: { id } });
  revalidatePath("/compras");
}
