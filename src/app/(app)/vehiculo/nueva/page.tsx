import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireVehiculoStaff } from "@/lib/vehiculo/access";
import ActaEntregaForm from "@/components/vehiculo/ActaEntregaForm";

export default async function VehiculoNuevaPage() {
  await requireVehiculoStaff();

  const [vehiculos, conductores] = await Promise.all([
    prisma.vehiculo.findMany({ where: { activo: true, salidaAbiertaId: null }, orderBy: { placa: "asc" } }),
    prisma.user.findMany({ where: { role: "CONDUCTOR", activo: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-verde-800">Nueva acta de entrega</h1>

      {vehiculos.length === 0 ? (
        <div className="card">
          <p className="text-sm text-tierra-500">
            No hay vehículos disponibles — o no hay ninguno registrado, o todos tienen una salida abierta.{" "}
            <Link href="/vehiculo/ajustes" className="text-verde-700 underline">
              Ir a Ajustes
            </Link>
          </p>
        </div>
      ) : conductores.length === 0 ? (
        <div className="card">
          <p className="text-sm text-tierra-500">
            Todavía no hay ningún usuario con rol Conductor —{" "}
            <Link href="/usuarios" className="text-verde-700 underline">
              créalo en Usuarios
            </Link>{" "}
            antes de hacer la primera acta.
          </p>
        </div>
      ) : (
        <ActaEntregaForm
          vehiculos={vehiculos.map((v) => ({ id: v.id, placa: v.placa }))}
          conductores={conductores.map((c) => ({ id: c.id, name: c.name }))}
        />
      )}
    </div>
  );
}
