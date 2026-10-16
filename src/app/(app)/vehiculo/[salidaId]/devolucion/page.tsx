import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireDevolucionAccess } from "@/lib/vehiculo/access";
import TerminarRutaForm from "@/components/vehiculo/TerminarRutaForm";

export default async function VehiculoDevolucionPage({ params }: { params: Promise<{ salidaId: string }> }) {
  const { salidaId } = await params;
  await requireDevolucionAccess(salidaId);

  const salida = await prisma.vehiculoSalida.findUnique({
    where: { id: salidaId },
    include: { vehiculo: true, conductor: true },
  });
  if (!salida) notFound();
  if (salida.checkinAt) notFound();

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-verde-800">
        Terminar ruta — {salida.vehiculo.placa} · {salida.conductor.name}
      </h1>
      <TerminarRutaForm salidaId={salidaId} checkoutKm={salida.checkoutKm} />
    </div>
  );
}
