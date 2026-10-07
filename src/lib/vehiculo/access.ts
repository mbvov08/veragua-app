import "server-only";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/** ADMIN/EMPLEADA tienen acceso completo al módulo; CONDUCTOR solo a sus propias salidas
 * (el filtrado por dueño lo hace cada caller, ver requireOwnSalida). */
export async function requireVehiculoAccess() {
  const session = await auth();
  if (!session?.user || !["ADMIN", "EMPLEADA", "CONDUCTOR"].includes(session.user.role)) {
    throw new Error("No tienes acceso al módulo Vehículo.");
  }
  return session;
}

/** Para acciones/datos que requieren crear o cerrar actas — eso solo lo hace el staff,
 * nunca el conductor (la entrega/devolución la hace la empresa con el conductor
 * presente, no el conductor solo). */
export async function requireVehiculoStaff() {
  const session = await requireVehiculoAccess();
  if (session.user.role !== "ADMIN" && session.user.role !== "EMPLEADA") {
    throw new Error("Solo el staff (gerencia/coordinación) puede hacer esto.");
  }
  return session;
}

export async function requireVehiculoAdmin() {
  const session = await requireVehiculoAccess();
  if (session.user.role !== "ADMIN") {
    throw new Error("Solo la administradora puede hacer esto.");
  }
  return session;
}

/** Carga una salida verificando que, si quien pregunta es CONDUCTOR, sea el dueño. */
export async function requireOwnSalida(session: Awaited<ReturnType<typeof requireVehiculoAccess>>, salidaId: string) {
  const salida = await prisma.vehiculoSalida.findUniqueOrThrow({ where: { id: salidaId } });
  const isStaff = session.user.role === "ADMIN" || session.user.role === "EMPLEADA";
  if (!isStaff && salida.conductorId !== session.user.id) {
    throw new Error("No tienes acceso a esta salida.");
  }
  return salida;
}
