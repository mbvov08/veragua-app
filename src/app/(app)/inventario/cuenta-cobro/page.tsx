import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import CuentaCobroVisor from "@/components/inventario/CuentaCobroVisor";

/** Envoltorio de la cuenta de cobro: en el celular el PDF abierto directo no deja
 * compartirlo ni volver, así que se abre aquí, con sus botones. */
export default async function CuentaCobroPage({
  searchParams,
}: {
  searchParams: Promise<{ clienteId?: string; start?: string; end?: string; saleIds?: string }>;
}) {
  const params = await searchParams;
  if (!params.clienteId) notFound();
  const cliente = await prisma.cliente.findUnique({ where: { id: params.clienteId } });
  if (!cliente) notFound();

  const qs = new URLSearchParams({ clienteId: params.clienteId });
  for (const k of ["start", "end", "saleIds"] as const) if (params[k]) qs.set(k, params[k]!);

  return (
    <CuentaCobroVisor
      pdfUrl={`/api/inventario/export/cuenta-cobro?${qs}`}
      titulo={`Cuenta de cobro — ${cliente.nombre}`}
      nombreArchivo={`cuenta-cobro-${cliente.nombre.replace(/\s+/g, "-").toLowerCase()}.pdf`}
      volverHref="/inventario/cuentas-por-cobrar"
    />
  );
}
