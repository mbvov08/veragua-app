"use client";

import { useState, useTransition } from "react";
import { clockIn, clockOut } from "@/lib/actions/personal";

const MOTIVOS = [
  { value: "CARGA_TRABAJO", label: "Fue por cantidad de trabajo" },
  { value: "INGRESO_TARDE_COMPENSO", label: "Ingresé más tarde y estoy compensando" },
  { value: "ALMUERZO_EXTENDIDO", label: "Me demoré almorzando más de lo habitual" },
  { value: "COMPROMISO_PERSONAL", label: "Tuve que cumplir un compromiso personal" },
  { value: "OTRO", label: "Otro motivo" },
];

function esSalidaTardiaAhora() {
  const now = new Date();
  const day = now.getDay(); // 0=domingo..6=sábado, hora local del dispositivo
  if (day === 0) return false;
  const horaCorte = day === 6 ? 17 : 19;
  return now.getHours() >= horaCorte;
}

export default function ClockWidget({
  status,
  clockInLabel,
  clockOutLabel,
  workedLabel,
}: {
  status: "none" | "in" | "done";
  clockInLabel?: string;
  clockOutLabel?: string;
  workedLabel?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pidiendoJustificacion, setPidiendoJustificacion] = useState(false);
  const [motivo, setMotivo] = useState("CARGA_TRABAJO");
  const [justificacion, setJustificacion] = useState("");
  const [esJustificable, setEsJustificable] = useState<boolean | null>(null);

  function handle(action: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Ocurrió un error");
      }
    });
  }

  function handleMarcarSalida() {
    if (esSalidaTardiaAhora() && !pidiendoJustificacion) {
      setPidiendoJustificacion(true);
      return;
    }
    if (pidiendoJustificacion) {
      if (!justificacion.trim()) {
        setError("Escribe una breve justificación de la salida tardía.");
        return;
      }
      if (esJustificable === null) {
        setError("Indica si consideras que tu salida tardía es justificable.");
        return;
      }
    }
    handle(() =>
      clockOut(
        pidiendoJustificacion ? motivo : undefined,
        pidiendoJustificacion ? justificacion : undefined,
        pidiendoJustificacion ? esJustificable ?? undefined : undefined
      )
    );
  }

  return (
    <div className="card">
      <h2 className="mb-3 text-sm font-semibold text-verde-800">Mi horario de hoy</h2>

      {status === "none" && (
        <button
          disabled={isPending}
          onClick={() => handle(clockIn)}
          className="btn-primary w-full text-base py-3"
        >
          ▶ Marcar entrada
        </button>
      )}

      {status === "in" && (
        <div className="space-y-3">
          <p className="text-sm text-tierra-600">
            Entrada: <span className="font-medium text-tierra-800">{clockInLabel}</span>
          </p>

          {pidiendoJustificacion && (
            <div className="space-y-3 rounded-lg bg-tierra-50 p-3">
              <p className="text-xs text-tierra-600">
                Estás saliendo después de tu horario habitual. Cuéntanos por qué:
              </p>
              <select
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                className="input text-sm"
              >
                {MOTIVOS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
              <textarea
                value={justificacion}
                onChange={(e) => setJustificacion(e.target.value)}
                placeholder="Justificación breve"
                rows={2}
                className="input text-sm"
              />
              <div>
                <p className="mb-1 text-xs font-medium text-tierra-700">
                  ¿Consideras que esta salida tardía es justificable?
                </p>
                <div className="flex gap-3">
                  <label className="flex items-center gap-1.5 text-xs text-tierra-700">
                    <input
                      type="radio"
                      name="esJustificable"
                      checked={esJustificable === true}
                      onChange={() => setEsJustificable(true)}
                    />
                    Sí, es justificable
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-tierra-700">
                    <input
                      type="radio"
                      name="esJustificable"
                      checked={esJustificable === false}
                      onChange={() => setEsJustificable(false)}
                    />
                    No, no es justificable
                  </label>
                </div>
              </div>
            </div>
          )}

          <button
            disabled={isPending}
            onClick={handleMarcarSalida}
            className="btn-danger w-full text-base py-3"
          >
            ■ {pidiendoJustificacion ? "Confirmar salida" : "Marcar salida"}
          </button>
        </div>
      )}

      {status === "done" && (
        <div className="space-y-1">
          <p className="text-sm text-tierra-600">
            Entrada: <span className="font-medium text-tierra-800">{clockInLabel}</span>
          </p>
          <p className="text-sm text-tierra-600">
            Salida: <span className="font-medium text-tierra-800">{clockOutLabel}</span>
          </p>
          <p className="text-sm text-verde-700">
            Horas trabajadas: <span className="font-semibold">{workedLabel}</span>
          </p>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
