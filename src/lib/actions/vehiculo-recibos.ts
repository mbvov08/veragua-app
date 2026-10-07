"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireVehiculoAccess, requireOwnSalida } from "@/lib/vehiculo/access";
import { putPrivateVehiculoBlob } from "@/lib/vehiculo/blob";

/** El conductor va cargando los recibos de tanqueo/peaje desde su celular durante el
 * viaje, incluso antes de la devolución — así no se pierden los papeles. */
export async function subirRecibo(salidaId: string, formData: FormData) {
  const session = await requireVehiculoAccess();
  const salida = await requireOwnSalida(session, salidaId);
  if (salida.checkinAt) throw new Error("Esta salida ya está cerrada, no se pueden agregar más recibos.");

  const tipo = String(formData.get("tipo") ?? "");
  const valor = Number(formData.get("valor"));
  const galonesOLugar = String(formData.get("galonesOLugar") ?? "").trim() || null;
  const file = formData.get("foto") as File | null;

  if (tipo !== "COMBUSTIBLE" && tipo !== "PEAJE") throw new Error("Tipo de recibo inválido.");
  if (!(valor > 0)) throw new Error("El valor debe ser mayor a cero.");
  if (!file || file.size === 0) throw new Error("La foto del recibo es obligatoria.");

  const blob = await putPrivateVehiculoBlob(`vehiculo/${crypto.randomUUID()}-recibo.jpg`, file);
  const archivo = await prisma.vehiculoArchivo.create({
    data: { blobPathname: blob.pathname, contentType: blob.contentType, subidoPorId: session.user.id, salidaId },
  });
  await prisma.vehiculoRecibo.create({
    data: { salidaId, tipo, valor, galonesOLugar, archivoId: archivo.id, subidoPorId: session.user.id },
  });

  revalidatePath(`/vehiculo/${salidaId}`);
}
