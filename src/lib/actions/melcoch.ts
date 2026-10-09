"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { dateOnlyToUTC, todayColombia } from "@/lib/date";
import { computeStocks } from "@/lib/melcoch";
import { computeSingleProductStock } from "@/lib/inventario/stock";

function requireMelcochAccess(role: string) {
  if (role !== "ADMIN" && role !== "EMPLEADA") throw new Error("No autorizado.");
}

const PRODUCTO_NORMAL = "Brownie personal - caja plástica";
const PRODUCTO_POR_FORMA: Record<string, string> = {
  CIRCULAR: "Brownie de Milo Familiar - Circular",
  CORAZON: "Brownie de Milo Familiar - Corazón",
  CUADRADO: "Brownie de Milo Familiar - Cuadrado",
};

/** Suma `cantidad` unidades al stock calculado de `nombreProducto` vía un ajuste de
 * inventario (mismo mecanismo que un conteo físico) — la producción en Melcoch es, en
 * la práctica, una reposición del producto terminado, igual que una compra. */
async function sumarStockProducido(nombreProducto: string, cantidad: number, fecha: Date, creadoPorId: string) {
  const producto = await prisma.finProduct.findFirst({ where: { nombre: nombreProducto, company: "MELCOCH" } });
  if (!producto) return;
  const teoricoAntes = await computeSingleProductStock(producto.id);
  await prisma.finInventoryAdjustment.create({
    data: {
      productoId: producto.id,
      teoricoAntes,
      contado: teoricoAntes + cantidad,
      diferencia: cantidad,
      motivo: `Producción registrada en Melcoch (${cantidad} unidades)`,
      fecha,
      creadoPorId,
    },
  });
}

export async function registrarProduccionMelcoch(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("No autenticado");
  requireMelcochAccess(session.user.role);

  const fechaStr = String(formData.get("fecha") ?? "");
  const mezclas = Number(formData.get("mezclas"));
  const cajasNormales = Number(formData.get("cajasNormales") ?? 0);
  const cajasFamiliares = Number(formData.get("cajasFamiliares") ?? 0);
  const formaFamiliar = String(formData.get("formaFamiliar") ?? "").trim() || null;
  const observaciones = String(formData.get("observaciones") ?? "").trim() || null;
  if (!fechaStr || !mezclas || mezclas <= 0) {
    throw new Error("Completa la fecha y las mezclas producidas.");
  }
  if (cajasFamiliares > 0 && !formaFamiliar) {
    throw new Error("Selecciona qué forma de molde familiar hiciste.");
  }

  const fecha = dateOnlyToUTC(fechaStr);

  // Solo se suma al stock de Inventario la primera vez que se guarda este día — si se
  // edita después (ej. para corregir un número), no se vuelve a sumar, para no duplicar.
  const yaExistia = await prisma.melcochProduccionDiaria.findUnique({ where: { fecha } });

  await prisma.melcochProduccionDiaria.upsert({
    where: { fecha },
    update: { mezclas, cajasNormales, cajasFamiliares, formaFamiliar, observaciones },
    create: {
      fecha,
      mezclas,
      cajasNormales,
      cajasFamiliares,
      formaFamiliar,
      observaciones,
      creadoPorId: session.user.id,
    },
  });

  if (!yaExistia) {
    if (cajasNormales > 0) {
      await sumarStockProducido(PRODUCTO_NORMAL, cajasNormales, fecha, session.user.id);
    }
    if (cajasFamiliares > 0 && formaFamiliar) {
      const nombreProducto = PRODUCTO_POR_FORMA[formaFamiliar];
      if (nombreProducto) await sumarStockProducido(nombreProducto, cajasFamiliares, fecha, session.user.id);
    }
  }

  revalidatePath("/melcoch");
  revalidatePath("/inventario/productos");
}

export async function registrarCompraIngrediente(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("No autenticado");
  requireMelcochAccess(session.user.role);

  const ingredienteId = String(formData.get("ingredienteId") ?? "");
  const cantidad = Number(formData.get("cantidad"));
  const fechaStr = String(formData.get("fecha") ?? "");
  const observaciones = String(formData.get("observaciones") ?? "").trim() || null;
  if (!ingredienteId || !cantidad || cantidad <= 0 || !fechaStr) {
    throw new Error("Completa el ingrediente, la cantidad y la fecha.");
  }

  await prisma.melcochCompraIngrediente.create({
    data: {
      ingredienteId,
      cantidad,
      fecha: dateOnlyToUTC(fechaStr),
      observaciones,
      creadoPorId: session.user.id,
    },
  });

  revalidatePath("/melcoch");
}

export async function realizarConteoFisico(formData: FormData) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Solo la administradora puede hacer el conteo físico.");
  }

  const fechaStr = String(formData.get("fecha") ?? "");
  const fecha = fechaStr ? dateOnlyToUTC(fechaStr) : todayColombia();
  const stocks = await computeStocks();

  for (const ing of stocks) {
    const raw = formData.get(`conteo_${ing.id}`);
    if (raw === null || String(raw).trim() === "") continue;
    const contado = Number(raw);
    if (Number.isNaN(contado)) continue;

    await prisma.melcochAjusteInventario.create({
      data: {
        ingredienteId: ing.id,
        teoricoAntes: ing.stock,
        contado,
        diferencia: contado - ing.stock,
        fecha,
        creadoPorId: session.user.id,
      },
    });
  }

  revalidatePath("/melcoch");
}
