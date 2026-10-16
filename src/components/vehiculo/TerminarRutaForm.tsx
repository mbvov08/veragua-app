"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cerrarSalida } from "@/lib/actions/vehiculo";

/** Terminar la ruta: solo el kilometraje de llegada. */
export default function TerminarRutaForm({ salidaId, checkoutKm }: { salidaId: string; checkoutKm: number }) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMsg(null);
    setEnviando(true);
    try {
      await cerrarSalida(salidaId, new FormData(e.currentTarget));
      router.push(`/vehiculo/${salidaId}`);
    } catch (err) {
      setEnviando(false);
      setErrorMsg(err instanceof Error ? err.message : "No se pudo terminar la ruta.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card grid gap-3">
      <p className="text-sm text-tierra-600">Km de partida: {checkoutKm.toLocaleString("es-CO")}</p>
      <div>
        <label className="label">Kilometraje de llegada</label>
        <input type="number" name="checkinKm" min={checkoutKm} step="1" inputMode="numeric" required className="input" />
      </div>
      <div>
        <label className="label">Observaciones (opcional)</label>
        <input type="text" name="observacionesDevolucion" className="input" />
      </div>
      {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}
      <div>
        <button type="submit" disabled={enviando} className="btn-primary">
          {enviando ? "Guardando..." : "Terminar ruta"}
        </button>
      </div>
    </form>
  );
}
