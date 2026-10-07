"use client";

import { useEffect, useMemo, useState } from "react";
import { compressImage } from "@/lib/vehiculo/compressImage";
import UploadStatusBadge from "@/components/vehiculo/UploadStatusBadge";

export default function PhotoCaptureField({
  label,
  value,
  onChange,
  onProcesandoChange,
  compararUrl,
}: {
  label: string;
  value: Blob | null;
  onChange: (blob: Blob | null) => void;
  onProcesandoChange?: (procesando: boolean) => void;
  /** URL de la foto del mismo ángulo tomada en la entrega, para mostrarla al lado en la devolución. */
  compararUrl?: string;
}) {
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // La URL se crea en render (useMemo), no en un efecto con setState — el efecto solo
  // se encarga de revocarla cuando cambia o el componente se desmonta.
  const previewUrl = useMemo(() => (value ? URL.createObjectURL(value) : null), [value]);
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function handleFile(file: File) {
    setError(null);
    setProcesando(true);
    onProcesandoChange?.(true);
    try {
      const compressed = await compressImage(file);
      onChange(compressed);
    } catch {
      setError("No se pudo procesar la foto, intenta de nuevo.");
    } finally {
      setProcesando(false);
      onProcesandoChange?.(false);
    }
  }

  return (
    <div className="rounded-lg border border-verde-100 bg-white p-2">
      <p className="mb-1 text-xs font-medium text-tierra-700">{label}</p>
      <div className="flex items-start gap-2">
        {compararUrl && (
          <div className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={compararUrl} alt="Foto de la entrega" className="h-16 w-16 rounded object-cover" />
            <p className="mt-0.5 text-center text-[10px] text-tierra-400">entrega</p>
          </div>
        )}
        {previewUrl && (
          <div className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt={label} className="h-16 w-16 rounded object-cover" />
          </div>
        )}
        <div className="min-w-0 flex-1">
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
          {procesando && <UploadStatusBadge />}
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>
      </div>
    </div>
  );
}
