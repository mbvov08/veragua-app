"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { crearSalida } from "@/lib/actions/vehiculo";

type Opcion = { id: string; name: string };

/** Comenzar la ruta: solo el kilometraje de partida. Los pedidos que lleva el conductor
 * los asigna el staff después, desde el detalle de la salida. */
export default function IniciarRutaForm({
  vehiculos,
  conductores,
  esConductor,
  rutaProgramadaId,
}: {
  vehiculos: { id: string; placa: string }[];
  conductores: Opcion[];
  esConductor: boolean;
  rutaProgramadaId?: string;
}) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMsg(null);
    setEnviando(true);
    try {
      const formData = new FormData(e.currentTarget);
      if (rutaProgramadaId) formData.set("rutaProgramadaId", rutaProgramadaId);
      const result = await crearSalida(formData);
      router.push(`/vehiculo/${result.id}`);
    } catch (err) {
      setEnviando(false);
      setErrorMsg(err instanceof Error ? err.message : "No se pudo comenzar la ruta.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card grid gap-3 sm:grid-cols-2">
      <div>
        <label className="label">Vehículo</label>
        <select name="vehiculoId" required className="input">
          {vehiculos.map((v) => (
            <option key={v.id} value={v.id}>{v.placa}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Conductor</label>
        <select name="conductorId" required className="input" defaultValue={esConductor ? conductores[0]?.id : undefined}>
          {conductores.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className="label">Kilometraje de partida</label>
        <input type="number" name="checkoutKm" min="1" step="1" inputMode="numeric" required className="input" />
      </div>
      <div className="sm:col-span-2">
        <label className="label">Observaciones (opcional)</label>
        <input type="text" name="observacionesEntrega" className="input" />
      </div>
      {errorMsg && <p className="text-sm text-red-600 sm:col-span-2">{errorMsg}</p>}
      <div className="sm:col-span-2">
        <button type="submit" disabled={enviando} className="btn-primary">
          {enviando ? "Guardando..." : "Comenzar ruta"}
        </button>
      </div>
    </form>
  );
}
