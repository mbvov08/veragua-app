"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { compressImage } from "@/lib/vehiculo/compressImage";
import { marcarPedidoEntregadoConductor } from "@/lib/actions/vehiculo-entregas";

export default function MarcarEntregadoForm({ orderId, salidaId }: { orderId: string; salidaId: string }) {
  const router = useRouter();
  const [procesando, setProcesando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleFile(file: File) {
    setErrorMsg(null);
    setProcesando(true);
    try {
      const compressed = await compressImage(file);
      setEnviando(true);
      const formData = new FormData();
      formData.set("foto", compressed, "remision.jpg");
      await marcarPedidoEntregadoConductor(orderId, salidaId, formData);
      router.refresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "No se pudo marcar como entregado.");
    } finally {
      setProcesando(false);
      setEnviando(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <label className="chip-edit cursor-pointer">
        {enviando ? "Guardando..." : procesando ? "Procesando..." : "Marcar entregado"}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          disabled={procesando || enviando}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />
      </label>
      {errorMsg && <p className="text-xs text-red-600">{errorMsg}</p>}
    </div>
  );
}
