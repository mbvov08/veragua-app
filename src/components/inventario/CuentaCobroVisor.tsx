"use client";

import { useState } from "react";
import Link from "next/link";

export default function CuentaCobroVisor({
  pdfUrl,
  titulo,
  nombreArchivo,
  volverHref,
  volverTexto = "← Volver a Cuentas por Cobrar",
}: {
  pdfUrl: string;
  titulo: string;
  nombreArchivo: string;
  volverHref: string;
  volverTexto?: string;
}) {
  const [compartiendo, setCompartiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function compartir() {
    setError(null);
    setCompartiendo(true);
    try {
      const blob = await (await fetch(pdfUrl)).blob();
      const file = new File([blob], nombreArchivo, { type: "application/pdf" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: titulo });
      } else if (navigator.share) {
        await navigator.share({ title: titulo, url: new URL(pdfUrl, window.location.origin).toString() });
      } else {
        window.open(pdfUrl, "_blank");
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) setError("No se pudo compartir. Usa Abrir PDF o Descargar.");
    } finally {
      setCompartiendo(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href={volverHref} className="text-sm text-verde-700 underline">{volverTexto}</Link>
          <h1 className="mt-1 text-lg font-semibold text-verde-800">{titulo}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={compartir} disabled={compartiendo} className="btn-primary">
            {compartiendo ? "Preparando..." : "Compartir"}
          </button>
          <a href={pdfUrl} target="_blank" rel="noreferrer" className="btn-outline">Abrir PDF</a>
          <a href={`${pdfUrl}&descargar=1`} className="btn-outline">Descargar</a>
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <iframe src={pdfUrl} title={titulo} className="hidden h-[80vh] w-full rounded-lg border border-verde-100 bg-white md:block" />
      <p className="text-sm text-tierra-500 md:hidden">
        Toca <strong>Compartir</strong> para enviarla por WhatsApp u otra app, o <strong>Abrir PDF</strong> para verla.
      </p>
    </div>
  );
}
