"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function crearProducto(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("No autenticado");

  const nombre = String(formData.get("nombre") ?? "").trim();
  const categoria = String(formData.get("categoria") ?? "").trim() || "Otros";
  if (!nombre) throw new Error("Escribe el nombre del producto.");

  await prisma.producto.upsert({
    where: { nombre },
    update: { categoria },
    create: { nombre, categoria, creadoPorId: session.user.id },
  });

  revalidatePath("/pedidos");
}

export async function eliminarProducto(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("No autenticado");

  await prisma.orderItem.deleteMany({ where: { productoId: id } });
  await prisma.producto.delete({ where: { id } });
  revalidatePath("/pedidos");
}
