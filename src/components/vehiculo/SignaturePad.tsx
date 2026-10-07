"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";

export type SignaturePadHandle = {
  clear: () => void;
  isEmpty: () => boolean;
  toBlob: () => Promise<Blob>;
};

/** Firma dibujada con el dedo (o mouse) en un canvas. Se usa dos veces por acta:
 * conductor y persona de la empresa. `onVaciaChange` avisa al padre cuando pasa de
 * vacía a dibujada (o viceversa) — necesario para que el padre pueda saber si falta
 * la firma sin leer el ref durante el render. */
const SignaturePad = forwardRef<SignaturePadHandle, { label: string; onVaciaChange?: (vacia: boolean) => void }>(function SignaturePad(
  { label, onVaciaChange },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const hasDrawnRef = useRef(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  function getCtx() {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.getContext("2d");
  }

  function pointFromEvent(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = getCtx();
    if (!ctx) return;
    drawingRef.current = true;
    const { x, y } = pointFromEvent(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const ctx = getCtx();
    if (!ctx) return;
    const { x, y } = pointFromEvent(e);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#1f2937";
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!hasDrawnRef.current) {
      hasDrawnRef.current = true;
      setHasDrawn(true);
      onVaciaChange?.(false);
    }
  }

  function handlePointerUp() {
    drawingRef.current = false;
  }

  useImperativeHandle(ref, () => ({
    clear() {
      const canvas = canvasRef.current;
      const ctx = getCtx();
      if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      hasDrawnRef.current = false;
      setHasDrawn(false);
      onVaciaChange?.(true);
    },
    isEmpty() {
      return !hasDrawnRef.current;
    },
    async toBlob() {
      const canvas = canvasRef.current;
      if (!canvas) throw new Error("Firma no disponible.");
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("No se pudo guardar la firma.");
      return blob;
    },
  }));

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className="label">{label}</label>
        {hasDrawn && (
          <button
            type="button"
            onClick={() => {
              const ctx = getCtx();
              const canvas = canvasRef.current;
              if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
              hasDrawnRef.current = false;
              setHasDrawn(false);
              onVaciaChange?.(true);
            }}
            className="text-xs text-tierra-500 underline"
          >
            Borrar
          </button>
        )}
      </div>
      <canvas
        ref={canvasRef}
        width={500}
        height={180}
        className="w-full touch-none rounded-lg border border-verde-200 bg-white"
        style={{ aspectRatio: "500 / 180" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />
      {!hasDrawn && <p className="mt-1 text-xs text-tierra-400">Firma aquí con el dedo o el mouse.</p>}
    </div>
  );
});

export default SignaturePad;
