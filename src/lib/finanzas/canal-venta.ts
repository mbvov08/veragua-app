import { prisma } from "@/lib/prisma";

/** Canal de una venta cuando no se eligió uno: "Distribución" si el cliente es distribuidor;
 * en cualquier otro caso se asume que llegó por WhatsApp (local, ecommerce y distribución
 * se marcan a mano). */
export async function canalPorDefectoVenta(company: string, clienteNombre: string | null): Promise<string | null> {
  const esDistribuidor = clienteNombre
    ? (await prisma.cliente.findUnique({ where: { nombre: clienteNombre }, select: { esDistribuidor: true } }))?.esDistribuidor
    : false;
  const nombre = esDistribuidor ? "Distribución" : "Por WhatsApp";
  return (await prisma.finChannel.findFirst({ where: { company, nombre }, select: { id: true } }))?.id ?? null;
}
