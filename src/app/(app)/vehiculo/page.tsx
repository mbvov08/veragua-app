import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireVehiculoAccess } from "@/lib/vehiculo/access";

export default async function VehiculoPage() {
  const session = await requireVehiculoAccess();
  const isStaff = session.user.role === "ADMIN" || session.user.role === "EMPLEADA";

  const vehiculos = await prisma.vehiculo.findMany({ where: { activo: true }, orderBy: { placa: "asc" } });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-verde-800">Vehículo</h1>
        {session.user.role === "ADMIN" && (
          <Link href="/vehiculo/ajustes" className="btn-outline text-xs">
            Ajustes de flota
          </Link>
        )}
      </div>

      <div className="card">
        <p className="text-sm text-tierra-600">
          Las actas de entrega y devolución (fotos, kilometraje, firmas) todavía se están construyendo —
          por ahora esta sección solo confirma que el vehículo y los permisos ya están listos.
        </p>
      </div>

      <div className="card">
        <h2 className="mb-3 text-sm font-semibold text-verde-800">Flota activa</h2>
        {vehiculos.length === 0 ? (
          <p className="text-sm text-tierra-500">
            {isStaff ? (
              <>
                Todavía no hay vehículos registrados —{" "}
                <Link href="/vehiculo/ajustes" className="text-verde-700 underline">
                  agrega uno en Ajustes
                </Link>
                .
              </>
            ) : (
              "Todavía no hay vehículos registrados."
            )}
          </p>
        ) : (
          <ul className="divide-y divide-verde-50">
            {vehiculos.map((v) => (
              <li key={v.id} className="py-2 text-sm text-tierra-800">
                {v.placa} <span className="text-tierra-500">{[v.marca, v.modelo].filter(Boolean).join(" ")}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
