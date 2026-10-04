"use server";

import { revalidatePath } from "next/cache";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { dateOnlyToUTC } from "@/lib/date";
import { requireFinanzas } from "@/lib/actions/finanzas";
import { parseCompany } from "@/lib/inventario/shared";
import { computeSingleProductStock } from "@/lib/inventario/stock";

function revalidateInventario() {
  revalidatePath("/inventario");
  revalidatePath("/inventario/productos");
}

export async function createProductCategory(formData: FormData) {
  await requireFinanzas();

  const company = parseCompany(formData.get("company"));
  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!nombre) throw new Error("El nombre de la categoría es obligatorio.");

  await prisma.finProductCategory.create({ data: { company, nombre } });
  revalidatePath("/inventario/ajustes/categorias");
}

export async function deleteProductCategory(categoryId: string) {
  await requireFinanzas();
  await prisma.finProductCategory.delete({ where: { id: categoryId } });
  revalidatePath("/inventario/ajustes/categorias");
}

export async function createProduct(formData: FormData) {
  const session = await requireFinanzas();

  const company = parseCompany(formData.get("company"));
  const categoriaId = String(formData.get("categoriaId") ?? "");
  const nombre = String(formData.get("nombre") ?? "").trim();
  const descripcion = String(formData.get("descripcion") ?? "").trim() || null;
  const precio = Number(formData.get("precio"));
  const foto = formData.get("foto");

  if (!categoriaId) throw new Error("Selecciona una categoría.");
  if (!nombre) throw new Error("El nombre del producto es obligatorio.");
  if (!(precio >= 0)) throw new Error("El precio debe ser mayor o igual a cero.");

  let imagenUrl: string | null = null;
  if (foto instanceof File && foto.size > 0) {
    const blob = await put(`productos/${company.toLowerCase()}-${Date.now()}-${foto.name}`, foto, {
      access: "public",
    });
    imagenUrl = blob.url;
  }

  await prisma.finProduct.create({
    data: {
      company,
      categoriaId,
      nombre,
      descripcion,
      precio,
      imagenUrl,
      creadoPorId: session.user.id,
    },
  });

  revalidateInventario();
}

export async function updateProduct(productId: string, formData: FormData) {
  await requireFinanzas();

  const categoriaId = String(formData.get("categoriaId") ?? "");
  const nombre = String(formData.get("nombre") ?? "").trim();
  const descripcion = String(formData.get("descripcion") ?? "").trim() || null;
  const precio = Number(formData.get("precio"));
  const foto = formData.get("foto");

  if (!categoriaId) throw new Error("Selecciona una categoría.");
  if (!nombre) throw new Error("El nombre del producto es obligatorio.");
  if (!(precio >= 0)) throw new Error("El precio debe ser mayor o igual a cero.");

  const data: Record<string, unknown> = { categoriaId, nombre, descripcion, precio };

  if (foto instanceof File && foto.size > 0) {
    const producto = await prisma.finProduct.findUniqueOrThrow({ where: { id: productId } });
    const blob = await put(`productos/${producto.company.toLowerCase()}-${Date.now()}-${foto.name}`, foto, {
      access: "public",
    });
    data.imagenUrl = blob.url;
  }

  await prisma.finProduct.update({ where: { id: productId }, data });
  revalidateInventario();
}

export async function toggleProductActivo(productId: string, activo: boolean) {
  await requireFinanzas();
  await prisma.finProduct.update({ where: { id: productId }, data: { activo } });
  revalidateInventario();
}

export async function registrarAjusteInventario(formData: FormData) {
  const session = await requireFinanzas();

  const productoId = String(formData.get("productoId") ?? "");
  const contado = Number(formData.get("contado"));
  const fechaStr = String(formData.get("fecha") ?? "");

  if (!productoId) throw new Error("Selecciona un producto.");
  if (!fechaStr) throw new Error("La fecha es obligatoria.");
  if (Number.isNaN(contado)) throw new Error("La cantidad contada es inválida.");

  const teoricoAntes = await computeSingleProductStock(productoId);
  const diferencia = contado - teoricoAntes;

  await prisma.finInventoryAdjustment.create({
    data: {
      productoId,
      teoricoAntes,
      contado,
      diferencia,
      fecha: dateOnlyToUTC(fechaStr),
      creadoPorId: session.user.id,
    },
  });

  revalidateInventario();
}
