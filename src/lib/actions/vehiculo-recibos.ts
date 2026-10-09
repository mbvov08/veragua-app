"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { todayColombia } from "@/lib/date";
import { requireVehiculoAccess, requireOwnSalida } from "@/lib/vehiculo/access";
import { putPrivateVehiculoBlob } from "@/lib/vehiculo/blob";
import { findDefaultCategory } from "@/lib/inventario/shared";

const CATEGORIA_POR_TIPO: Record<string, string> = {
  COMBUSTIBLE: "5221",
  PEAJE: "5221",
  PAGO_CONDUCTOR: "5222",
};

const LABEL_POR_TIPO: Record<string, string> = {
  COMBUSTIBLE: "Tanqueo",
  PEAJE: "Peaje",
  PAGO_CONDUCTOR: "Pago a conductor",
};

/** El conductor va cargando los gastos de la ruta (tanqueo, peaje, su propio pago)
 * desde su celular durante el viaje, incluso antes de la devolución — así no se pierden
 * los papeles. Cada uno crea además su FinTransaction (gasto) para que quede reflejado
 * en el PyG automáticamente, sin tener que registrarlo dos veces. */
export async function subirRecibo(salidaId: string, formData: FormData) {
  const session = await requireVehiculoAccess();
  const salida = await requireOwnSalida(session, salidaId);
  if (salida.checkinAt) throw new Error("Esta salida ya está cerrada, no se pueden agregar más recibos.");

  const tipo = String(formData.get("tipo") ?? "");
  const valor = Number(formData.get("valor"));
  const galonesOLugar = String(formData.get("galonesOLugar") ?? "").trim() || null;
  const file = formData.get("foto") as File | null;

  if (!["COMBUSTIBLE", "PEAJE", "PAGO_CONDUCTOR"].includes(tipo)) throw new Error("Tipo de recibo inválido.");
  if (!(valor > 0)) throw new Error("El valor debe ser mayor a cero.");
  // El pago al conductor normalmente no tiene un papel físico que fotografiar; tanqueo
  // y peaje sí lo exigen, para tener el soporte del gasto.
  if (tipo !== "PAGO_CONDUCTOR" && (!file || file.size === 0)) {
    throw new Error("La foto del recibo es obligatoria.");
  }

  let archivoId: string | null = null;
  if (file && file.size > 0) {
    const blob = await putPrivateVehiculoBlob(`vehiculo/${crypto.randomUUID()}-recibo.jpg`, file);
    const archivo = await prisma.vehiculoArchivo.create({
      data: { blobPathname: blob.pathname, contentType: blob.contentType, subidoPorId: session.user.id, salidaId },
    });
    archivoId = archivo.id;
  }

  const [vehiculo, conductor, categoria] = await Promise.all([
    prisma.vehiculo.findUniqueOrThrow({ where: { id: salida.vehiculoId }, select: { placa: true } }),
    prisma.user.findUniqueOrThrow({ where: { id: salida.conductorId }, select: { name: true } }),
    findDefaultCategory("VERAGUA", CATEGORIA_POR_TIPO[tipo]),
  ]);

  await prisma.$transaction(async (tx) => {
    const transaccion = await tx.finTransaction.create({
      data: {
        company: "VERAGUA",
        tipo: "expense",
        fecha: todayColombia(),
        monto: valor,
        categoriaId: categoria.id,
        descripcion: `${LABEL_POR_TIPO[tipo]} — ${vehiculo.placa} — ruta de ${conductor.name}`,
        contraparte: tipo === "PAGO_CONDUCTOR" ? conductor.name : null,
        fuente: "manual",
        creadoPorId: session.user.id,
      },
    });
    await tx.vehiculoRecibo.create({
      data: { salidaId, tipo, valor, galonesOLugar, archivoId, finTransactionId: transaccion.id, subidoPorId: session.user.id },
    });
  });

  revalidatePath(`/vehiculo/${salidaId}`);
  revalidatePath("/finanzas/movimientos");
  revalidatePath("/finanzas/pyg");
}
