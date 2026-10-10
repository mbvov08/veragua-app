import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import CuentaCobroVisor from "@/components/inventario/CuentaCobroVisor";

/** Igual que la cuenta de cobro: el PDF abierto directo en el celular no deja compartir ni volver. */
export default async function ComprobantePage({ params }: { params: Promise<{ saleId: string }> }) {
  const { saleId } = await params;
  const venta = await prisma.finSale.findUnique({ where: { id: saleId }, include: { cliente: true } });
  if (!venta) notFound();
  const cliente = venta.cliente?.nombre ?? "consumidor final";

  return (
    <CuentaCobroVisor
      pdfUrl={`/api/inventario/export/comprobante/${saleId}`}
      titulo={`Comprobante de venta — ${cliente}`}
      nombreArchivo={`comprobante-${cliente.replace(/\s+/g, "-").toLowerCase()}.pdf`}
      volverHref="/inventario/ventas"
      volverTexto="← Volver a Ventas"
    />
  );
}
