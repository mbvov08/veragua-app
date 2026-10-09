"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { compressImage } from "@/lib/vehiculo/compressImage";
import { subirRecibo } from "@/lib/actions/vehiculo-recibos";
import { TIPO_RECIBO } from "@/lib/vehiculo/constants";

export default function AgregarReciboForm({ salidaId }: { salidaId: string }) {
  const router = useRouter();
  const [tipo, setTipo] = useState("COMBUSTIBLE");
  const [valor, setValor] = useState("");
  const [galonesOLugar, setGalonesOLugar] = useState("");
  const [foto, setFoto] = useState<Blob | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleFile(file: File) {
    setProcesando(true);
    try {
      setFoto(await compressImage(file));
    } finally {
      setProcesando(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setEnviando(true);
    try {
      const formData = new FormData();
      formData.set("tipo", tipo);
      formData.set("valor", valor);
      formData.set("galonesOLugar", galonesOLugar);
      if (foto) formData.set("foto", foto, "recibo.jpg");
      await subirRecibo(salidaId, formData);
      setValor("");
      setGalonesOLugar("");
      setFoto(null);
      router.refresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "No se pudo subir el recibo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2 rounded-lg border border-verde-100 bg-verde-50/40 p-3">
      <div>
        <label className="label">Tipo</label>
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="input">
          {TIPO_RECIBO.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Valor</label>
        <input type="number" min="0" value={valor} onChange={(e) => setValor(e.target.value)} className="input w-28" required />
      </div>
      <div>
        <label className="label">
          {tipo === "COMBUSTIBLE" ? "Galones (opcional)" : tipo === "PEAJE" ? "Lugar (opcional)" : "Nota (opcional)"}
        </label>
        <input value={galonesOLugar} onChange={(e) => setGalonesOLugar(e.target.value)} className="input w-28" />
      </div>
      <div>
        <label className="label">Foto del recibo (opcional)</label>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
          className="input py-1 text-xs"
        />
      </div>
      <button type="submit" disabled={enviando || procesando} className="btn-secondary">
        {enviando ? "Subiendo..." : procesando ? "Procesando..." : "Agregar recibo"}
      </button>
      {errorMsg && <p className="w-full text-xs text-red-600">{errorMsg}</p>}
    </form>
  );
}
