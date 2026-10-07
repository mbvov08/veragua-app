import "server-only";
import { put, get } from "@vercel/blob";

/** Todo archivo del módulo Vehículo (fotos, firmas, recibos, remisiones) se sube
 * privado de verdad — nunca con access:"public" como las fotos de producto. La BD
 * solo guarda el pathname, nunca una URL usable directamente; servirlo requiere pasar
 * por /api/vehiculo/archivo/[archivoId], que valida sesión + ownership primero. */
export async function putPrivateVehiculoBlob(pathname: string, file: Blob): Promise<{ pathname: string; contentType: string }> {
  const blob = await put(pathname, file, { access: "private" });
  return { pathname: blob.pathname, contentType: file.type || "application/octet-stream" };
}

export async function getPrivateVehiculoBlob(pathname: string) {
  return get(pathname, { access: "private" });
}
