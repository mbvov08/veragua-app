"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireFinanzas } from "@/lib/actions/finanzas";

function revalidateReabastecimiento() {
  revalidatePath("/inventario/reabastecimiento");
}

export async function crearRelacionProductoProveedor(formData: FormData) {
  await requireFinanzas();

  const productoId = String(formData.get("productoId") ?? "");
  const proveedorId = String(formData.get("proveedorId") ?? "");
  const leadTimeDias = Number(formData.get("leadTimeDias"));
  const diasRevision = Number(formData.get("diasRevision"));
  const costoUnitarioReferenciaRaw = String(formData.get("costoUnitarioReferencia") ?? "").trim();
  const costoUnitarioReferencia = costoUnitarioReferenciaRaw ? Number(costoUnitarioReferenciaRaw) : null;

  if (!productoId) throw new Error("Selecciona un producto.");
  if (!proveedorId) throw new Error("Selecciona un proveedor.");
  if (!(leadTimeDias > 0)) throw new Error("El lead time debe ser mayor a cero días.");
  if (!(diasRevision > 0)) throw new Error("Elige cada cuánto se revisa/pide este producto.");

  await prisma.finProductoProveedor.upsert({
    where: { productoId_proveedorId: { productoId, proveedorId } },
    update: { leadTimeDias, diasRevision, costoUnitarioReferencia, activo: true },
    create: { productoId, proveedorId, leadTimeDias, diasRevision, costoUnitarioReferencia },
  });

  revalidateReabastecimiento();
}

export async function toggleRelacionProductoProveedorActiva(relacionId: string, activo: boolean) {
  await requireFinanzas();
  await prisma.finProductoProveedor.update({ where: { id: relacionId }, data: { activo } });
  revalidateReabastecimiento();
}
