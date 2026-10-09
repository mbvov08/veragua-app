import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireDevolucionAccess } from "@/lib/vehiculo/access";
import ActaDevolucionForm from "@/components/vehiculo/ActaDevolucionForm";

export default async function VehiculoDevolucionPage({ params }: { params: Promise<{ salidaId: string }> }) {
  const { salidaId } = await params;
  await requireDevolucionAccess(salidaId);

  const salida = await prisma.vehiculoSalida.findUnique({
    where: { id: salidaId },
    include: {
      vehiculo: true,
      conductor: true,
      fotos: { where: { momento: "ENTREGA" } },
    },
  });
  if (!salida) notFound();
  if (salida.checkinAt) notFound();

  const entregaFotos = Object.fromEntries(salida.fotos.map((f) => [f.angulo, f.archivoId]));

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-verde-800">
        Acta de devolución — {salida.vehiculo.placa} · {salida.conductor.name}
      </h1>
      <ActaDevolucionForm
        salidaId={salidaId}
        checkoutKm={salida.checkoutKm}
        entregaFotos={entregaFotos}
      />
    </div>
  );
}
