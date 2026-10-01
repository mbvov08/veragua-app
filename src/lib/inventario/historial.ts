import { prisma } from "@/lib/prisma";

export async function getHistorialCliente(clienteId: string) {
  const [cliente, facturas, pagos] = await Promise.all([
    prisma.cliente.findUniqueOrThrow({ where: { id: clienteId } }),
    prisma.finCuentaPorCobrar.findMany({ where: { clienteId }, orderBy: { fecha: "asc" } }),
    prisma.finPagoCliente.findMany({
      where: { clienteId },
      include: { aplicaciones: true },
      orderBy: { fecha: "asc" },
    }),
  ]);
  return { nombre: cliente.nombre, facturas, pagos };
}

export async function getHistorialProveedor(proveedorId: string) {
  const [proveedor, facturas, pagos] = await Promise.all([
    prisma.proveedor.findUniqueOrThrow({ where: { id: proveedorId } }),
    prisma.finCuentaPorPagar.findMany({ where: { proveedorId }, orderBy: { fecha: "asc" } }),
    prisma.finPagoProveedor.findMany({
      where: { proveedorId },
      include: { aplicaciones: true },
      orderBy: { fecha: "asc" },
    }),
  ]);
  return { nombre: proveedor.nombre, facturas, pagos };
}
